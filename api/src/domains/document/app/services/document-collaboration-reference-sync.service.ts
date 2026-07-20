import { Injectable } from '@nestjs/common';
import type * as Yjs from 'yjs';
import { DocumentCollaborationProjector } from '../ports/document-collaboration-projector';
import { DocumentCollaborationTransactionRunner } from '../ports/document-collaboration-transaction-runner';
import { DocumentSubdocReferenceRepository } from '../ports/document-subdoc-reference.repository';
import { extractDocumentSearchText } from '../utils/document-search-text.util';
import { loadYjs } from '../utils/yjs-runtime';
import { DocumentSubdocContentService } from './document-subdoc-content.service';
import { DocumentSubdocReferenceSyncService } from './document-subdoc-reference-sync.service';

@Injectable()
export class DocumentCollaborationReferenceSyncService {
  constructor(
    private readonly transactionRunner: DocumentCollaborationTransactionRunner,
    private readonly collaborationProjector: DocumentCollaborationProjector,
    private readonly documentSubdocContentService: DocumentSubdocContentService,
    private readonly documentSubdocReferenceSyncService: DocumentSubdocReferenceSyncService,
  ) {}

  async syncReferencedTitle(
    input: {
      targetDocumentId: string;
      title: string;
      workspaceId: string;
      updatedByUserId: string;
    },
  ): Promise<Array<{ documentId: string; snapshot: Uint8Array }>> {
    const Yjs = await loadYjs();
    const synchronizedDocuments = new Map<string, Uint8Array>();

    await this.transactionRunner.run(async ({
      commandRepository,
      collaborationRepository,
      subdocReferenceRepository,
    }) => {
      const sourceDocuments = await this.findSourceDocuments(
        input.targetDocumentId,
        input.workspaceId,
        subdocReferenceRepository,
      );

      for (const sourceDocument of sourceDocuments) {
        if (sourceDocument.id === input.targetDocumentId) {
          continue;
        }

        const collaborationState = await collaborationRepository.loadState(sourceDocument.id);

        if (!collaborationState) {
          const replaced = this.documentSubdocContentService.replaceTitle(
            sourceDocument.contentJson,
            input.targetDocumentId,
            input.title,
          );

          if (!replaced.changed) {
            continue;
          }

          sourceDocument.contentJson = replaced.content;
          sourceDocument.searchText = extractDocumentSearchText(replaced.content);
          commandRepository.assignUpdatedByUser(sourceDocument, input.updatedByUserId);
          await this.documentSubdocReferenceSyncService.execute(
            sourceDocument,
            subdocReferenceRepository,
          );
          await commandRepository.saveDocument(sourceDocument);
          continue;
        }

        const collaborationDocument = await this.loadCollaborationDocument(collaborationState);
        const currentProjection = await this.collaborationProjector.project(
          collaborationDocument,
        );
        const replaced = this.documentSubdocContentService.replaceTitle(
          currentProjection.content,
          input.targetDocumentId,
          input.title,
        );

        if (!replaced.changed) {
          continue;
        }

        const nextDocument = await this.collaborationProjector.createDocument(
          replaced.content,
          currentProjection.title,
        );

        const resetState = await collaborationRepository.replaceState(
          sourceDocument.id,
          Yjs.encodeStateAsUpdate(nextDocument),
        );

        await collaborationRepository.saveProjection(
          sourceDocument.id,
          resetState.sequence,
          currentProjection.title,
          replaced.content,
          Array.from(
            this.documentSubdocContentService.extractTargetDocumentIds(replaced.content),
          ),
          input.updatedByUserId,
        );

        synchronizedDocuments.set(
          sourceDocument.id,
          Yjs.encodeStateAsUpdate(nextDocument),
        );
      }
    });

    return Array.from(synchronizedDocuments, ([documentId, snapshot]) => ({
      documentId,
      snapshot,
    }));
  }

  private async findSourceDocuments(
    targetDocumentId: string,
    workspaceId: string,
    repository: DocumentSubdocReferenceRepository,
  ) {
    const references = await repository.findReferencesByTargetDocument(targetDocumentId);

    if (references.length > 0) {
      return references.map((reference) => reference.sourceDocument);
    }

    return repository.findReferencingDocuments(workspaceId, targetDocumentId);
  }

  private async loadCollaborationDocument(state: {
    snapshot: Uint8Array;
    updates: Array<{ update: Uint8Array }>;
  }): Promise<Yjs.Doc> {
    const Yjs = await loadYjs();
    const document = new Yjs.Doc();

    Yjs.applyUpdate(document, state.snapshot);

    for (const persistedUpdate of state.updates) {
      Yjs.applyUpdate(document, persistedUpdate.update);
    }

    return document;
  }
}
