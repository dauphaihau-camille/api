import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DocumentSubdocReferenceRepository } from '../ports/document-subdoc-reference.repository';
import { DocumentEntity } from '../../infra/persistence/entities/document.entity';
import { DocumentSubdocReferenceEntity } from '../../infra/persistence/entities/document-subdoc-reference.entity';
import { extractDocumentSearchText } from '../utils/document-search-text.util';

const SUBDOC_BLOCK_TYPE = 'subpage';

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
      },
      children: [],
    }));

    return [...content, ...newBlocks];
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
