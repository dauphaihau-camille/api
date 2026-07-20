import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type * as Yjs from 'yjs';
import type { AuthenticatedUser } from '../../../auth/app/auth.types';
import {
  DocumentCollaborationNotFoundError,
  DocumentCollaborationPermissionDeniedError,
  InvalidDocumentCollaborationUpdateError,
} from '../errors/document-collaboration.error';
import { DocumentCollaborationProjector } from '../ports/document-collaboration-projector';
import { DocumentCollaborationRepository } from '../ports/document-collaboration.repository';
import { normalizeTitle } from '../utils/document-title.util';
import { loadYjs } from '../utils/yjs-runtime';
import { DocumentCollaborationReferenceSyncService } from './document-collaboration-reference-sync.service';
import { DocumentSubdocContentService } from './document-subdoc-content.service';

type ActiveDocument = {
  document: Yjs.Doc;
  sequence: number;
};

const SNAPSHOT_COMPACTION_INTERVAL = 100;

@Injectable()
export class DocumentCollaborationService {
  private readonly activeDocuments = new Map<string, Promise<ActiveDocument>>();

  constructor(
    private readonly repository: DocumentCollaborationRepository,
    private readonly projector: DocumentCollaborationProjector,
    private readonly subdocContentService: DocumentSubdocContentService,
    private readonly referenceSyncService: DocumentCollaborationReferenceSyncService,
  ) {}

  async synchronize(
    documentId: string,
    currentUser: AuthenticatedUser,
    clientStateVector: Uint8Array,
  ): Promise<{
    canEdit: boolean;
    serverStateVector: Uint8Array;
    update: Uint8Array;
  }> {
    const Yjs = await loadYjs();
    const access = await this.requireAccess(documentId, currentUser.userId);
    const activeDocument = await this.getOrCreateActiveDocument(
      documentId,
      access.content,
      access.title,
    );

    return {
      canEdit: access.canEdit,
      serverStateVector: Yjs.encodeStateVector(activeDocument.document),
      update: Yjs.encodeStateAsUpdate(activeDocument.document, clientStateVector),
    };
  }

  async applyUpdate(
    documentId: string,
    currentUser: AuthenticatedUser,
    update: Uint8Array,
  ): Promise<{
    propagatedUpdates: Array<{ documentId: string; update: Uint8Array }>;
    sequence: number;
  }> {
    const Yjs = await loadYjs();
    const access = await this.requireAccess(documentId, currentUser.userId);

    if (!access.canEdit) {
      throw new DocumentCollaborationPermissionDeniedError();
    }

    const activeDocument = await this.getOrCreateActiveDocument(
      documentId,
      access.content,
      access.title,
    );
    const previousTitle = normalizeTitle(
      activeDocument.document.getMap('meta').get('title') as string | undefined,
    );
    const candidateDocument = new Yjs.Doc();

    try {
      Yjs.applyUpdate(
        candidateDocument,
        Yjs.encodeStateAsUpdate(activeDocument.document),
        this,
      );
      Yjs.applyUpdate(candidateDocument, update);
    }
    catch {
      throw new InvalidDocumentCollaborationUpdateError();
    }

    const projection = await this.projector.project(candidateDocument);

    const referencedDocumentIds = Array.from(
      this.subdocContentService.extractTargetDocumentIds(projection.content),
    );

    const updateHash = createHash('sha256').update(update).digest('hex');

    const sequence = await this.repository.appendUpdate(
      documentId,
      update,
      updateHash,
    );

    Yjs.applyUpdate(activeDocument.document, update);

    activeDocument.sequence = Math.max(activeDocument.sequence, sequence);

    await this.repository.saveProjection(
      documentId,
      sequence,
      projection.title,
      projection.content,
      referencedDocumentIds,
      currentUser.userId,
    );

    const propagatedUpdates: Array<{ documentId: string; update: Uint8Array }> = [];

    if (projection.title !== previousTitle) {
      const synchronizedDocuments = await this.referenceSyncService.syncReferencedTitle({
        targetDocumentId: documentId,
        title: projection.title,
        updatedByUserId: currentUser.userId,
        workspaceId: access.workspaceId,
      });

      for (const synchronizedDocument of synchronizedDocuments) {
        const activeReferencedDocument = await this.activeDocuments.get(
          synchronizedDocument.documentId,
        );

        if (!activeReferencedDocument) {
          this.evict(synchronizedDocument.documentId);
          continue;
        }

        const nextDocument = new Yjs.Doc();
        Yjs.applyUpdate(nextDocument, synchronizedDocument.snapshot);

        const propagatedUpdate = Yjs.encodeStateAsUpdate(
          nextDocument,
          Yjs.encodeStateVector(activeReferencedDocument.document),
        );

        if (propagatedUpdate.byteLength > 0) {
          Yjs.applyUpdate(activeReferencedDocument.document, propagatedUpdate);
          propagatedUpdates.push({
            documentId: synchronizedDocument.documentId,
            update: propagatedUpdate,
          });
        }

        activeReferencedDocument.sequence = 0;
      }
    }

    if (this.shouldCompactSnapshot(sequence)) {
      await this.repository.compactState(
        documentId,
        sequence,
        Yjs.encodeStateAsUpdate(activeDocument.document),
      );
    }

    return {
      propagatedUpdates,
      sequence,
    };
  }

  evict(documentId: string): void {
    this.activeDocuments.delete(documentId);
  }

  private shouldCompactSnapshot(sequence: number): boolean {
    return sequence > 0 && sequence % SNAPSHOT_COMPACTION_INTERVAL === 0;
  }

  private async requireAccess(documentId: string, userId: string) {
    const access = await this.repository.getAccess(documentId, userId);

    if (!access) {
      throw new DocumentCollaborationNotFoundError(documentId);
    }

    return access;
  }

  private getOrCreateActiveDocument(
    documentId: string,
    fallbackContent: unknown[],
    fallbackTitle: string,
  ): Promise<ActiveDocument> {
    const existing = this.activeDocuments.get(documentId);

    if (existing) {
      return existing;
    }

    const activeDocumentPromise = this.loadActiveDocument(
      documentId,
      fallbackContent,
      fallbackTitle,
    )
      .catch((error) => {
        this.activeDocuments.delete(documentId);
        throw error;
      });

    this.activeDocuments.set(documentId, activeDocumentPromise);
    return activeDocumentPromise;
  }

  private async loadActiveDocument(
    documentId: string,
    fallbackContent: unknown[],
    fallbackTitle: string,
  ): Promise<ActiveDocument> {
    const Yjs = await loadYjs();
    const state = await this.repository.loadState(documentId);

    if (!state) {
      const document = await this.projector.createDocument(fallbackContent, fallbackTitle);

      const initialized = await this.repository.initializeState(
        documentId,
        Yjs.encodeStateAsUpdate(document),
      );

      return {
        document,
        sequence: initialized.sequence,
      };
    }

    try {
      const document = new Yjs.Doc();
      Yjs.applyUpdate(document, state.snapshot);

      for (const persistedUpdate of state.updates) {
        Yjs.applyUpdate(document, persistedUpdate.update);
      }

      await this.projector.project(document);

      return {
        document,
        sequence: state.sequence,
      };
    }
    catch {
      const fallbackDocument = await this.projector.createDocument(
        fallbackContent,
        fallbackTitle,
      );

      const resetState = await this.repository.replaceState(
        documentId,
        Yjs.encodeStateAsUpdate(fallbackDocument),
      );

      return {
        document: fallbackDocument,
        sequence: resetState.sequence,
      };
    }
  }
}
