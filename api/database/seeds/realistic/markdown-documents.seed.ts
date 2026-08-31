import type { EntityManager } from '@mikro-orm/postgresql';
import { readdir, readFile } from 'node:fs/promises';
import {
  basename,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';
import { pathToFileURL } from 'node:url';
import { CurrentUserEntity } from '../../../src/domains/auth/infra/persistence/entities/current-user.entity';
import { extractDocumentSearchText } from '../../../src/domains/document/app/utils/document-search-text.util';
import { DocumentEntity } from '../../../src/domains/document/infra/persistence/entities/document.entity';
import { TeamspaceEntity } from '../../../src/domains/teamspace/infra/persistence/entities/teamspace.entity';
import { WorkspaceEntity } from '../../../src/domains/workspace/infra/persistence/entities/workspace.entity';
import { buildSubpageBlock } from './document-content.seed';
import { upsertDocument } from './documents.seed';
import type { SeedDocumentSummary, SeedUserSummary } from './realistic-seed.types';
import { buildSeededPublicId } from './shared.seed';

type MarkdownInlineContent = {
  type: 'text';
  text: string;
  styles?: {
    bold?: boolean;
  };
};

const BOLD_MARKDOWN_PATTERN = /\*\*([^*]+)\*\*/g;

type MarkdownSeedMetadata = {
  title?: string;
  workspace?: string;
  workspaceSlug?: string;
  teamspace?: string;
  ownerEmail?: string;
  sortKey?: number;
};

type MarkdownSeedFile = {
  relativePath: string;
  documentKey: string;
  parentKey?: string;
  metadata: MarkdownSeedMetadata;
  content: unknown[];
  title: string;
  workspaceSlug?: string;
};

type MarkdownSeedNode = MarkdownSeedFile & {
  workspace: WorkspaceEntity;
  teamspace?: TeamspaceEntity;
  owner: SeedUserSummary;
  summary?: SeedDocumentSummary;
};

export function parseMarkdownSeedFileContent(input: {
  relativePath: string;
  markdown: string;
}): MarkdownSeedFile {
  const { metadata, body } = parseFrontmatter(input.markdown);
  const pathSegments = input.relativePath.split('/');
  const fileName = pathSegments.at(-1) ?? input.relativePath;
  const title = metadata.title ?? findFirstHeading(body) ?? basename(fileName, '.md');
  const documentSegments = (pathSegments.length === 1 ? pathSegments : pathSegments.slice(1))
    .map((segment, index, segments) =>
      index === segments.length - 1 ? basename(segment, '.md') : segment);

  return {
    relativePath: input.relativePath,
    documentKey: documentSegments.join('/'),
    parentKey: documentSegments.length > 1 ? documentSegments.slice(0, -1).join('/') : undefined,
    metadata,
    content: buildMarkdownDocumentContent(body),
    title,
    workspaceSlug: metadata.workspaceSlug ?? metadata.workspace ?? (pathSegments.length > 1 ? pathSegments[0] : undefined),
  };
}

export function buildMarkdownDocumentContent(markdown: string): unknown[] {
  const blocks: unknown[] = [];
  const paragraphLines: string[] = [];
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let fencedCodeLines: string[] | undefined;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return;
    }

    blocks.push(markdownParagraph(paragraphLines.join(' ')));
    paragraphLines.length = 0;
  };

  for (const line of lines) {
    const trimmedLine = line.trim();
    const fenceMatch = trimmedLine.match(/^```/);

    if (fenceMatch) {
      if (fencedCodeLines) {
        paragraphLines.push(fencedCodeLines.join('\n'));
        fencedCodeLines = undefined;
      }
      else {
        flushParagraph();
        fencedCodeLines = [];
      }
      continue;
    }

    if (fencedCodeLines) {
      fencedCodeLines.push(line);
      continue;
    }

    if (trimmedLine === '') {
      flushParagraph();
      continue;
    }

    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      blocks.push(markdownHeading(headingMatch[2]!, Math.min(headingMatch[1]!.length, 3) as 1 | 2 | 3));
      continue;
    }

    const listItem = parseMarkdownListItem(trimmedLine);
    if (listItem) {
      flushParagraph();
      blocks.push({
        type: listItem.type,
        content: parseInlineMarkdown(listItem.text),
      });
      continue;
    }

    const imageMatch = trimmedLine.match(/^!\[([^\]]*)]\(([^)]+)\)$/);
    if (imageMatch) {
      flushParagraph();
      blocks.push(markdownParagraph(`Image: ${imageMatch[1] || 'untitled'} (${imageMatch[2]})`));
      continue;
    }
    paragraphLines.push(normalizeMarkdownLine(trimmedLine));
  }

  if (fencedCodeLines) {
    paragraphLines.push(fencedCodeLines.join('\n'));
  }

  flushParagraph();

  return blocks.length > 0 ? blocks : [markdownParagraph('')];
}

export async function seedMarkdownDocuments(input: {
  em: EntityManager;
  users: SeedUserSummary[];
  seedDataDir?: string;
}): Promise<SeedDocumentSummary[]> {
  const seedDataDirs = await resolveMarkdownSeedDataDirs(input.seedDataDir);

  if (seedDataDirs.length === 0) {
    return [];
  }

  const files = await readMarkdownSeedFiles(seedDataDirs);

  if (files.length === 0) {
    return [];
  }

  const usersByEmail = new Map(input.users.map((user) => [user.email, user]));
  const parsedFiles = files.map((file) => parseMarkdownSeedFileContent(file));
  const filesByKey = new Map(parsedFiles.map((file) => [file.documentKey, file]));
  const nodes = new Map<string, MarkdownSeedNode>();

  for (const file of parsedFiles) {
    const inheritedMetadata = resolveInheritedMetadata(file, filesByKey);
    const workspaceSlug = inheritedMetadata.workspaceSlug ?? inheritedMetadata.workspace ?? file.workspaceSlug;
    const ownerEmail = inheritedMetadata.ownerEmail;

    if (!workspaceSlug) {
      throw new Error(`Markdown seed file ${file.relativePath} requires workspace frontmatter or a workspace directory`);
    }

    if (!ownerEmail) {
      throw new Error(`Markdown seed file ${file.relativePath} requires ownerEmail frontmatter on itself or an ancestor`);
    }

    const workspace = await input.em.findOne(WorkspaceEntity, { slug: workspaceSlug });
    const owner = usersByEmail.get(ownerEmail);

    if (!workspace) {
      throw new Error(`Markdown seed file ${file.relativePath} references unknown workspace ${workspaceSlug}`);
    }

    if (!owner) {
      throw new Error(`Markdown seed file ${file.relativePath} references unknown ownerEmail ${ownerEmail}`);
    }

    const teamspace = inheritedMetadata.teamspace
      ? await input.em.findOne(TeamspaceEntity, { workspace: workspace.id, name: inheritedMetadata.teamspace }) ?? undefined
      : undefined;

    if (inheritedMetadata.teamspace && !teamspace) {
      throw new Error(`Markdown seed file ${file.relativePath} references unknown teamspace ${inheritedMetadata.teamspace}`);
    }

    nodes.set(file.documentKey, {
      ...file,
      metadata: inheritedMetadata,
      workspace,
      teamspace,
      owner,
    });
  }

  for (const node of nodes.values()) {
    if (node.parentKey && !nodes.has(node.parentKey)) {
      throw new Error(`Markdown seed file ${node.relativePath} requires parent document ${node.parentKey}.md`);
    }
  }

  const orderedNodes = Array.from(nodes.values()).sort((left, right) => {
    const depthDelta = left.documentKey.split('/').length - right.documentKey.split('/').length;
    return depthDelta === 0 ? left.relativePath.localeCompare(right.relativePath) : depthDelta;
  });

  for (const [index, node] of orderedNodes.entries()) {
    const parentSummary = node.parentKey ? nodes.get(node.parentKey)?.summary : undefined;

    node.summary = await upsertDocument(input.em, {
      key: `markdown:${node.documentKey}`,
      publicId: buildSeededPublicId(`markdown:${node.relativePath}`),
      workspaceId: node.workspace.id,
      teamspaceId: node.teamspace?.id ?? parentSummary?.teamspaceId,
      parentDocumentId: parentSummary?.id,
      title: node.title,
      contentJson: node.content,
      sortKey: node.metadata.sortKey ?? index,
      createdById: node.owner.id,
      updatedById: node.owner.id,
    });
  }

  const childSummariesByParentKey = new Map<string, SeedDocumentSummary[]>();
  for (const node of orderedNodes) {
    if (!node.parentKey || !node.summary) {
      continue;
    }

    const childSummaries = childSummariesByParentKey.get(node.parentKey) ?? [];
    childSummaries.push(node.summary);
    childSummariesByParentKey.set(node.parentKey, childSummaries);
  }

  for (const node of orderedNodes) {
    const childSummaries = childSummariesByParentKey.get(node.documentKey);

    if (!node.summary || !childSummaries || childSummaries.length === 0) {
      continue;
    }

    const nextContent = [
      ...node.content,
      ...childSummaries.map((childDocument) => buildSubpageBlock({
        documentId: childDocument.id,
        publicId: childDocument.publicId,
        workspaceId: childDocument.workspaceId,
        title: childDocument.title,
      })),
    ];
    const document = await input.em.findOneOrFail(DocumentEntity, { id: node.summary.id });

    document.contentJson = nextContent;
    document.searchText = extractDocumentSearchText(nextContent);
    document.updatedBy = input.em.getReference(CurrentUserEntity, node.owner.id);
    input.em.persist(document);
  }

  await input.em.flush();

  return orderedNodes.flatMap((node) => node.summary ? [node.summary] : []);
}

function parseFrontmatter(markdown: string): { metadata: MarkdownSeedMetadata; body: string } {
  if (!markdown.startsWith('---\n')) {
    return { metadata: {}, body: markdown };
  }

  const closingIndex = markdown.indexOf('\n---\n', 4);
  if (closingIndex === -1) {
    return { metadata: {}, body: markdown };
  }

  const metadata = markdown
    .slice(4, closingIndex)
    .split('\n')
    .reduce<MarkdownSeedMetadata>((result, line) => {
      const match = line.match(/^([A-Za-z][A-Za-z0-9_]*):\s*(.*)$/);

      if (!match) {
        return result;
      }

      const key = match[1] as keyof MarkdownSeedMetadata;
      const value = unquoteFrontmatterValue(match[2] ?? '');

      if (key === 'sortKey') {
        const sortKey = Number(value);
        if (!Number.isInteger(sortKey)) {
          throw new Error('Markdown seed frontmatter sortKey must be an integer');
        }
        result.sortKey = sortKey;
        return result;
      }

      if (key === 'title' || key === 'workspace' || key === 'workspaceSlug' || key === 'teamspace' || key === 'ownerEmail') {
        result[key] = value;
      }

      return result;
    }, {});

  return {
    metadata,
    body: markdown.slice(closingIndex + '\n---\n'.length),
  };
}

function resolveInheritedMetadata(
  file: MarkdownSeedFile,
  filesByKey: Map<string, MarkdownSeedFile>,
): MarkdownSeedMetadata {
  const chain: MarkdownSeedFile[] = [];
  let currentFile: MarkdownSeedFile | undefined = file;

  while (currentFile) {
    chain.unshift(currentFile);
    currentFile = currentFile.parentKey ? filesByKey.get(currentFile.parentKey) : undefined;
  }

  return chain.reduce<MarkdownSeedMetadata>((metadata, chainFile) => ({
    ...metadata,
    ...chainFile.metadata,
  }), {});
}

function findFirstHeading(markdown: string): string | undefined {
  return markdown
    .split('\n')
    .map((line) => line.trim().match(/^#\s+(.+)$/)?.[1])
    .find((title): title is string => Boolean(title));
}

function markdownParagraph(text: string): unknown {
  return {
    type: 'paragraph',
    content: parseInlineMarkdown(text),
  };
}

function markdownHeading(text: string, level: 1 | 2 | 3): unknown {
  return {
    type: 'heading',
    props: { level },
    content: parseInlineMarkdown(text),
  };
}

function parseInlineMarkdown(text: string): MarkdownInlineContent[] {
  const segments: MarkdownInlineContent[] = [];
  let lastIndex = 0;

  BOLD_MARKDOWN_PATTERN.lastIndex = 0;

  for (const match of text.matchAll(BOLD_MARKDOWN_PATTERN)) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', text: text.slice(lastIndex, match.index) });
    }

    segments.push({
      type: 'text',
      text: match[1]!,
      styles: { bold: true },
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', text: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', text }];
}

function parseMarkdownListItem(line: string): { type: 'bulletListItem' | 'numberedListItem'; text: string } | undefined {
  const unorderedListItem = line.match(/^[-*+]\s+(.+)$/);
  if (unorderedListItem) {
    return { type: 'bulletListItem', text: unorderedListItem[1]! };
  }

  const orderedListItem = line.match(/^\d+[.)]\s+(.+)$/);
  return orderedListItem ? { type: 'numberedListItem', text: orderedListItem[1]! } : undefined;
}

function normalizeMarkdownLine(line: string): string {
  const tableLine = line.match(/^\|(.+)\|$/);

  if (tableLine) {
    return tableLine[1]!
      .split('|')
      .map((cell) => cell.trim())
      .filter(Boolean)
      .join(' | ');
  }

  return line;
}

function unquoteFrontmatterValue(value: string): string {
  const trimmedValue = value.trim();
  const quotedValue = trimmedValue.match(/^['"](.*)['"]$/);

  return quotedValue ? quotedValue[1]! : trimmedValue;
}

async function resolveMarkdownSeedDataDirs(configuredDir?: string): Promise<string[]> {
  const explicitDir = configuredDir ?? process.env.SEED_MARKDOWN_DOCUMENTS_DIR;

  if (explicitDir) {
    return await existingDirectories([explicitDir]);
  }

  return await existingDirectories([
    resolve(process.cwd(), '../seed-data/documents'),
    resolve(process.cwd(), '../seed-data/documents.local'),
    resolve(process.cwd(), 'seed-data/documents'),
    resolve(process.cwd(), 'seed-data/documents.local'),
  ]);
}

async function existingDirectories(candidates: string[]): Promise<string[]> {
  const directories: string[] = [];

  for (const candidate of candidates) {
    try {
      await readdir(candidate);
      directories.push(candidate);
    }
    catch {
      // Try the next conventional seed-data location.
    }
  }

  return directories;
}

async function readMarkdownSeedFiles(seedDataDirs: string[]): Promise<Array<{ relativePath: string; markdown: string }>> {
  const filesByRelativePath = new Map<string, { relativePath: string; markdown: string }>();

  async function visit(seedDataDir: string, directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(directory, entry.name);

      if (entry.isDirectory()) {
        await visit(seedDataDir, fullPath);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith('.md')) {
        continue;
      }

      const markdownFile = {
        relativePath: relative(seedDataDir, fullPath).split(sep).join('/'),
        markdown: await readFile(pathToFileURL(fullPath), 'utf8'),
      };

      filesByRelativePath.set(markdownFile.relativePath, markdownFile);
    }
  }

  for (const seedDataDir of seedDataDirs) {
    await visit(seedDataDir, seedDataDir);
  }

  return Array.from(filesByRelativePath.values())
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}
