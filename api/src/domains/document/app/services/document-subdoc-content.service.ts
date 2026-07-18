import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DocumentEntity } from '../../infra/persistence/entities/document.entity';
import { hasMeaningfulContent } from '../utils/document-content.util';

const SUBDOC_BLOCK_TYPE = 'subdoc';

@Injectable()
export class DocumentSubdocContentService {
  extractTargetDocumentIds(content: unknown[]): Set<string> {
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

  replaceReferencesInContent(
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

  appendMissingChildBlocks(
    content: unknown[],
    parentDocument: DocumentEntity,
    duplicatedDocuments: DocumentEntity[],
  ): unknown[] {
    const referencedDocumentIds = this.extractTargetDocumentIds(content);
    const directChildren = duplicatedDocuments.filter((document) => document.parentDocument?.id === parentDocument.id);
    const missingChildren = directChildren.filter((child) => !referencedDocumentIds.has(child.id));

    if (missingChildren.length === 0) {
      return content;
    }

    const newBlocks = missingChildren.map((child) => this.buildSubdocBlock(child));

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
    const referencedDocumentIds = this.extractTargetDocumentIds(content);

    if (referencedDocumentIds.has(childDocument.id)) {
      return content;
    }

    const subdocBlock = this.buildSubdocBlock(childDocument);

    if (content.length === 1) {
      const rootBlock = content[0];

      if (
        rootBlock
        && typeof rootBlock === 'object'
        && !Array.isArray(rootBlock)
        && this.isReplaceableEmptyParagraph(rootBlock as {
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

    const insertedAtAnchor = this.insertAtAnchor(
      content,
      anchorBlockId,
      subdocBlock,
      slashCommandText,
    );

    if (insertedAtAnchor.inserted) {
      return insertedAtAnchor.blocks;
    }

    const replaceableEmptyParagraphPaths = this.collectReplaceableEmptyParagraphPaths(
      content,
      slashCommandText,
    );

    if (replaceableEmptyParagraphPaths.length === 1) {
      return this.replaceBlockAtPath(content, replaceableEmptyParagraphPaths[0] as number[], subdocBlock);
    }

    return [
      ...content,
      subdocBlock,
    ];
  }

  removeBlocks(
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

  replaceTitle(
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

  private buildSubdocBlock(childDocument: DocumentEntity) {
    return {
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
  }

  private hasMeaningfulInlineContent(inlineContent: unknown) {
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
  }

  private extractInlineText(inlineContent: unknown) {
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
  }

  private isReplaceableEmptyParagraph(block: {
    type?: unknown;
    content?: unknown;
    props?: unknown;
    children?: unknown;
  }) {
    if (block.type !== 'paragraph') {
      return false;
    }

    if (Array.isArray(block.children) && block.children.length > 0) {
      return false;
    }

    return !this.hasMeaningfulInlineContent(block.content);
  }

  private shouldReplaceAnchorBlock(
    block: {
      type?: unknown;
      content?: unknown;
      props?: unknown;
      children?: unknown;
    },
    slashCommandText?: string,
  ) {
    if (block.type !== 'paragraph') {
      return false;
    }

    if (Array.isArray(block.children) && block.children.length > 0) {
      return false;
    }

    const inlineText = this.extractInlineText(block.content).trim();

    if (
      slashCommandText
      && inlineText === slashCommandText.trim()
    ) {
      return true;
    }

    return this.isReplaceableEmptyParagraph(block);
  }

  private insertAtAnchor(
    blocks: unknown[],
    anchorBlockId: string,
    subdocBlock: ReturnType<DocumentSubdocContentService['buildSubdocBlock']>,
    slashCommandText?: string,
  ): { inserted: boolean; blocks: unknown[] } {
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
        if (this.shouldReplaceAnchorBlock(block, slashCommandText)) {
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
        const nested = this.insertAtAnchor(
          block.children,
          anchorBlockId,
          subdocBlock,
          slashCommandText,
        );

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
  }

  private collectReplaceableEmptyParagraphPaths(
    blocks: unknown[],
    slashCommandText?: string,
    path: number[] = [],
  ): number[][] {
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

      if (this.shouldReplaceAnchorBlock(block, slashCommandText)) {
        paths.push(nextPath);
      }

      if (Array.isArray(block.children) && block.children.length > 0) {
        paths.push(...this.collectReplaceableEmptyParagraphPaths(
          block.children,
          slashCommandText,
          nextPath,
        ));
      }
    }

    return paths;
  }

  private replaceBlockAtPath(
    blocks: unknown[],
    path: number[],
    subdocBlock: ReturnType<DocumentSubdocContentService['buildSubdocBlock']>,
  ): unknown[] {
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
        children: this.replaceBlockAtPath(block.children, rest, subdocBlock),
      };
    });
  }
}
