import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DocumentSubdocReferenceRepository } from '../ports/document-subdoc-reference.repository';
import { DocumentEntity } from '../../infra/persistence/entities/document.entity';
import { DocumentSubdocReferenceEntity } from '../../infra/persistence/entities/document-subdoc-reference.entity';
import { hasMeaningfulContent } from '../utils/document-content.util';
import { extractDocumentSearchText } from '../utils/document-search-text.util';

const SUBDOC_BLOCK_TYPE = 'subdoc';

@Injectable()
export class DocumentSubdocService {
  constructor(private readonly documentSubdocReferenceRepository: DocumentSubdocReferenceRepository) {}

  async syncSubdocReferencesForDoc(
    document: DocumentEntity,
    repository: DocumentSubdocReferenceRepository = this.documentSubdocReferenceRepository,
  ): Promise<void> {
    const nextTargetDocumentIds = this.extractSubdocTargetDocumentIds(document.contentJson);
    const existingReferences = await repository.findReferencesBySourceDocument(document.id);

    const existingTargetDocumentIds = new Set(
      existingReferences.map((reference) => reference.targetDocument.id),
    );

    for (const reference of existingReferences) {
      if (nextTargetDocumentIds.has(reference.targetDocument.id)) {
        continue;
      }

      repository.removeSubdocReference(reference);
    }

    const newReferences: DocumentSubdocReferenceEntity[] = [];

    for (const targetDocumentId of nextTargetDocumentIds) {
      if (existingTargetDocumentIds.has(targetDocumentId)) {
        continue;
      }

      newReferences.push(repository.createSubdocReference({
        workspace: document.workspace.id,
        sourceDocument: document.id,
        targetDocument: targetDocumentId,
      }));
    }

    if (newReferences.length > 0) {
      repository.persistSubdocReferences(newReferences);
    }
  }

  async syncReferencedSubdocTitles(
    document: DocumentEntity,
  ): Promise<void> {
    const references = await this.documentSubdocReferenceRepository.findReferencesByTargetDocument(document.id);

    if (references.length === 0) {
      const referencingDocuments = await this.documentSubdocReferenceRepository.findReferencingDocuments(document.workspace.id, document.id);

      for (const sourceDocument of referencingDocuments) {
        const { changed, content } = this.replaceSubdocTitleInContent(
          sourceDocument.contentJson,
          document.id,
          document.title,
        );

        if (!changed) {
          continue;
        }

        sourceDocument.contentJson = content;
        sourceDocument.searchText = extractDocumentSearchText(content);
        sourceDocument.updatedBy = document.updatedBy;
        await this.syncSubdocReferencesForDoc(sourceDocument, this.documentSubdocReferenceRepository);
      }

      return;
    }

    for (const reference of references) {
      const sourceDocument = reference.sourceDocument;
      const { changed, content } = this.replaceSubdocTitleInContent(
        sourceDocument.contentJson,
        document.id,
        document.title,
      );

      if (!changed) {
        continue;
      }

      sourceDocument.contentJson = content;
      sourceDocument.searchText = extractDocumentSearchText(content);
      sourceDocument.updatedBy = document.updatedBy;
    }
  }

  async removeArchivedSubdocReferences(
    targetDocuments: DocumentEntity[],
    repository: DocumentSubdocReferenceRepository = this.documentSubdocReferenceRepository,
  ): Promise<void> {
    if (targetDocuments.length === 0) {
      return;
    }

    const archivedDocumentIds = new Set(targetDocuments.map((document) => document.id));
    const externalSourceDocumentsById = new Map<string, DocumentEntity>();

    for (const targetDocument of targetDocuments) {
      const references = await repository.findReferencesByTargetDocument(targetDocument.id);

      if (references.length === 0) {
        const referencingDocuments = await repository.findReferencingDocuments(
          targetDocument.workspace.id,
          targetDocument.id,
        );

        for (const sourceDocument of referencingDocuments) {
          if (archivedDocumentIds.has(sourceDocument.id)) {
            continue;
          }

          externalSourceDocumentsById.set(sourceDocument.id, sourceDocument);
        }

        continue;
      }

      for (const reference of references) {
        const sourceDocument = reference.sourceDocument;

        if (archivedDocumentIds.has(sourceDocument.id)) {
          continue;
        }

        externalSourceDocumentsById.set(sourceDocument.id, sourceDocument);
      }
    }

    for (const sourceDocument of externalSourceDocumentsById.values()) {
      const { changed, content } = this.removeSubdocBlocksFromContent(
        sourceDocument.contentJson,
        archivedDocumentIds,
      );

      if (!changed) {
        continue;
      }

      sourceDocument.contentJson = content;
      sourceDocument.searchText = extractDocumentSearchText(content);
      sourceDocument.updatedBy = targetDocuments[0]?.updatedBy ?? sourceDocument.updatedBy;
      await this.syncSubdocReferencesForDoc(sourceDocument, repository);
    }
  }

  extractSubdocTargetDocumentIds(content: unknown[]): Set<string> {
    const targetDocumentIds = new Set<string>();

    const visitBlock = (value: unknown): void => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return;
      }

      const block = value as {
        type?: unknown;
        props?: unknown;
        children?: unknown;
      };

      if (
        block.type === SUBDOC_BLOCK_TYPE
        && block.props
        && typeof block.props === 'object'
        && !Array.isArray(block.props)
      ) {
        const documentId = (block.props as { documentId?: unknown }).documentId;

        if (typeof documentId === 'string' && documentId.length > 0) {
          targetDocumentIds.add(documentId);
        }
      }

      if (Array.isArray(block.children) && block.children.length > 0) {
        block.children.forEach(visitBlock);
      }
    };

    content.forEach(visitBlock);

    return targetDocumentIds;
  }

  replaceSubdocReferencesInContent(
    content: unknown[],
    duplicatedDocumentByOriginalId: Map<string, DocumentEntity>,
  ): unknown[] {
    let changed = false;

    const replaceInBlock = (value: unknown): unknown => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return value;
      }

      const block = value as {
        type?: unknown;
        props?: unknown;
        children?: unknown;
      };

      let nextBlock = block;

      if (
        block.type === SUBDOC_BLOCK_TYPE
        && block.props
        && typeof block.props === 'object'
        && !Array.isArray(block.props)
      ) {
        const props = block.props as {
          documentId?: unknown;
          publicId?: unknown;
          title?: unknown;
        };
        const duplicatedDocument = typeof props.documentId === 'string'
          ? duplicatedDocumentByOriginalId.get(props.documentId)
          : undefined;

        if (duplicatedDocument) {
          changed = true;
          nextBlock = {
            ...block,
            props: {
              ...props,
              documentId: duplicatedDocument.id,
              publicId: duplicatedDocument.publicId,
              title: duplicatedDocument.title,
            },
          };
        }
      }

      if (Array.isArray(nextBlock.children) && nextBlock.children.length > 0) {
        const nextChildren = nextBlock.children.map(replaceInBlock);

        if (nextChildren.some((child, index) => child !== nextBlock.children?.[index])) {
          nextBlock = {
            ...nextBlock,
            children: nextChildren,
          };
        }
      }

      return nextBlock;
    };

    const nextContent = content.map(replaceInBlock);

    return changed ? nextContent : content;
  }

  appendMissingChildSubdocBlocks(
    content: unknown[],
    parentDocument: DocumentEntity,
    duplicatedDocuments: DocumentEntity[],
  ): unknown[] {
    const referencedDocumentIds = this.extractSubdocTargetDocumentIds(content);
    const directChildren = duplicatedDocuments.filter((document) => document.parentDocument?.id === parentDocument.id);
    const missingChildren = directChildren.filter((child) => !referencedDocumentIds.has(child.id));

    if (missingChildren.length === 0) {
      return content;
    }

    const newBlocks = missingChildren.map((child) => ({
      id: randomUUID(),
      type: SUBDOC_BLOCK_TYPE,
      props: {
        documentId: child.id,
        publicId: child.publicId,
        workspaceId: child.workspace.id,
        title: child.title,
        hasContent: hasMeaningfulContent(child.contentJson),
      },
      children: [],
    }));

    return [...content, ...newBlocks];
  }

  appendSubdocBlock(
    content: unknown[],
    childDocument: DocumentEntity,
  ): unknown[] {
    return this.insertSubdocBlock(content, childDocument);
  }

  insertSubdocBlock(
    content: unknown[],
    childDocument: DocumentEntity,
    anchorBlockId?: string,
    slashCommandText?: string,
  ): unknown[] {
    const referencedDocumentIds = this.extractSubdocTargetDocumentIds(content);

    if (referencedDocumentIds.has(childDocument.id)) {
      return content;
    }

    const subdocBlock = {
      id: randomUUID(),
      type: SUBDOC_BLOCK_TYPE,
      props: {
        documentId: childDocument.id,
        publicId: childDocument.publicId,
        workspaceId: childDocument.workspace.id,
        title: childDocument.title,
        hasContent: hasMeaningfulContent(childDocument.contentJson),
      },
      children: [],
    };

    const hasMeaningfulInlineContent = (inlineContent: unknown) => {
      if (!Array.isArray(inlineContent) || inlineContent.length === 0) {
        return false;
      }

      return inlineContent.some((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return true;
        }

        const text = (item as { text?: unknown }).text;
        return typeof text === 'string' ? text.trim().length > 0 : true;
      });
    };

    const extractInlineText = (inlineContent: unknown) => {
      if (!Array.isArray(inlineContent) || inlineContent.length === 0) {
        return '';
      }

      return inlineContent.map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return '';
        }

        const text = (item as { text?: unknown }).text;
        return typeof text === 'string' ? text : '';
      }).join('');
    };

    const isReplaceableEmptyParagraph = (block: {
      type?: unknown;
      content?: unknown;
      props?: unknown;
      children?: unknown;
    }) => {
      if (block.type !== 'paragraph') {
        return false;
      }

      if (Array.isArray(block.children) && block.children.length > 0) {
        return false;
      }

      return !hasMeaningfulInlineContent(block.content);
    };

    if (content.length === 1) {
      const rootBlock = content[0];

      if (
        rootBlock
        && typeof rootBlock === 'object'
        && !Array.isArray(rootBlock)
        && isReplaceableEmptyParagraph(rootBlock as {
          type?: unknown;
          content?: unknown;
          props?: unknown;
          children?: unknown;
        })
      ) {
        return [subdocBlock];
      }
    }

    if (!anchorBlockId) {
      return [
        ...content,
        subdocBlock,
      ];
    }

    const shouldReplaceAnchorBlock = (block: {
      type?: unknown;
      content?: unknown;
      props?: unknown;
      children?: unknown;
    }) => {
      if (block.type !== 'paragraph') {
        return false;
      }

      if (Array.isArray(block.children) && block.children.length > 0) {
        return false;
      }

      const inlineText = extractInlineText(block.content).trim();

      if (
        slashCommandText
        && inlineText === slashCommandText.trim()
      ) {
        return true;
      }

      return isReplaceableEmptyParagraph(block);
    };

    const insertAtAnchor = (blocks: unknown[]): { inserted: boolean; blocks: unknown[] } => {
      const nextBlocks: unknown[] = [];

      for (const [index, value] of blocks.entries()) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          nextBlocks.push(value);
          continue;
        }

        const block = value as {
          id?: unknown;
          type?: unknown;
          content?: unknown;
          props?: unknown;
          children?: unknown;
        };

        if (block.id === anchorBlockId) {
          if (shouldReplaceAnchorBlock(block)) {
            nextBlocks.push(subdocBlock);
          }
          else {
            nextBlocks.push(block, subdocBlock);
          }

          return {
            inserted: true,
            blocks: [...nextBlocks, ...blocks.slice(index + 1)],
          };
        }

        if (Array.isArray(block.children) && block.children.length > 0) {
          const nested = insertAtAnchor(block.children);

          if (nested.inserted) {
            nextBlocks.push({
              ...block,
              children: nested.blocks,
            });

            return {
              inserted: true,
              blocks: [...nextBlocks, ...blocks.slice(index + 1)],
            };
          }
        }

        nextBlocks.push(block);
      }

      return {
        inserted: false,
        blocks,
      };
    };

    const insertedAtAnchor = insertAtAnchor(content);

    if (insertedAtAnchor.inserted) {
      return insertedAtAnchor.blocks;
    }

    const collectReplaceableEmptyParagraphPaths = (
      blocks: unknown[],
      path: number[] = [],
    ): number[][] => {
      const paths: number[][] = [];

      for (const [index, value] of blocks.entries()) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          continue;
        }

        const block = value as {
          type?: unknown;
          content?: unknown;
          props?: unknown;
          children?: unknown;
        };
        const nextPath = [...path, index];

        if (shouldReplaceAnchorBlock(block)) {
          paths.push(nextPath);
        }

        if (Array.isArray(block.children) && block.children.length > 0) {
          paths.push(...collectReplaceableEmptyParagraphPaths(block.children, nextPath));
        }
      }

      return paths;
    };

    const replaceBlockAtPath = (
      blocks: unknown[],
      path: number[],
    ): unknown[] => {
      const [index, ...rest] = path;

      if (index === undefined) {
        return blocks;
      }

      return blocks.map((value, currentIndex) => {
        if (currentIndex !== index) {
          return value;
        }

        if (rest.length === 0) {
          return subdocBlock;
        }

        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          return value;
        }

        const block = value as {
          children?: unknown;
        };

        if (!Array.isArray(block.children)) {
          return value;
        }

        return {
          ...block,
          children: replaceBlockAtPath(block.children, rest),
        };
      });
    };

    const replaceableEmptyParagraphPaths = collectReplaceableEmptyParagraphPaths(content);

    if (replaceableEmptyParagraphPaths.length === 1) {
      return replaceBlockAtPath(content, replaceableEmptyParagraphPaths[0] as number[]);
    }

    return [
      ...content,
      subdocBlock,
    ];
  }

  removeSubdocBlocksFromContent(
    content: unknown[],
    documentIds: Set<string>,
  ): { changed: boolean; content: unknown[] } {
    let changed = false;

    const removeFromBlocks = (blocks: unknown[]): unknown[] => {
      const nextBlocks: unknown[] = [];

      for (const value of blocks) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          nextBlocks.push(value);
          continue;
        }

        const block = value as {
          type?: unknown;
          props?: unknown;
          children?: unknown;
        };

        if (
          block.type === SUBDOC_BLOCK_TYPE
          && block.props
          && typeof block.props === 'object'
          && !Array.isArray(block.props)
        ) {
          const documentId = (block.props as { documentId?: unknown }).documentId;

          if (typeof documentId === 'string' && documentIds.has(documentId)) {
            changed = true;
            continue;
          }
        }

        let nextBlock = block;

        if (Array.isArray(block.children) && block.children.length > 0) {
          const nextChildren = removeFromBlocks(block.children);

          if (
            nextChildren.length !== block.children.length
            || nextChildren.some((child, index) => child !== block.children?.[index])
          ) {
            nextBlock = {
              ...block,
              children: nextChildren,
            };
          }
        }

        nextBlocks.push(nextBlock);
      }

      return nextBlocks;
    };

    const nextContent = removeFromBlocks(content);

    return {
      changed,
      content: changed ? nextContent : content,
    };
  }

  private replaceSubdocTitleInContent(
    content: unknown[],
    documentId: string,
    title: string,
  ): { changed: boolean; content: unknown[] } {
    let changed = false;

    const replaceInBlock = (value: unknown): unknown => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return value;
      }

      const block = value as {
        type?: unknown;
        props?: unknown;
        children?: unknown;
      };

      let nextBlock = block;

      if (
        block.type === SUBDOC_BLOCK_TYPE
        && block.props
        && typeof block.props === 'object'
        && !Array.isArray(block.props)
        && (block.props as { documentId?: unknown }).documentId === documentId
        && (block.props as { title?: unknown }).title !== title
      ) {
        changed = true;
        nextBlock = {
          ...block,
          props: {
            ...(block.props as Record<string, unknown>),
            title,
          },
        };
      }

      if (Array.isArray(nextBlock.children) && nextBlock.children.length > 0) {
        const nextChildren = nextBlock.children.map(replaceInBlock);

        if (nextChildren.some((child, index) => child !== nextBlock.children?.[index])) {
          nextBlock = {
            ...nextBlock,
            children: nextChildren,
          };
        }
      }

      return nextBlock;
    };

    const nextContent = content.map(replaceInBlock);

    return {
      changed,
      content: changed ? nextContent : content,
    };
  }
}
