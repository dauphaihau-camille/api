import { createHash } from 'node:crypto';
import * as Yjs from 'yjs';
import type { AuthenticatedUser } from '../../../auth/app/auth.types';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import {
  DocumentCollaborationPermissionDeniedError,
} from '../errors/document-collaboration.error';
import type {
  DocumentCollaborationRepository,
  PersistedDocumentCollaborationState,
} from '../ports/document-collaboration.repository';
import type { DocumentCollaborationProjector } from '../ports/document-collaboration-projector';
import { DocumentAccessResolver } from '../policies/document-access.resolver';
import type { DocumentCollaborationReferenceSyncService } from './document-collaboration-reference-sync.service';
import { DocumentCollaborationService } from './document-collaboration.service';
import { DocumentSubdocContentService } from './document-subdoc-content.service';

describe('DocumentCollaborationService', () => {
  const user: AuthenticatedUser = {
    userId: 'user-1',
    email: 'editor@example.com',
    status: 'active' as never,
    sessionId: 'session-1',
    roles: [],
    permissions: [],
  };

  function createRepository() {
    let state: PersistedDocumentCollaborationState | null = null;

    const repository: jest.Mocked<DocumentCollaborationRepository> = {
      getAccess: jest.fn().mockResolvedValue({
        content: [{ type: 'paragraph', content: 'Initial content' }],
        title: 'Initial title',
        workspaceId: 'workspace-1',
        workspaceRole: WorkspaceRole.OWNER,
      }),
      loadState: jest.fn(async (_documentId: string) => state),
      initializeState: jest.fn(async (_documentId, snapshot) => {
        state = { sequence: 0, snapshot, updates: [] };
        return state;
      }),
      replaceState: jest.fn(async (_documentId, snapshot) => {
        state = { sequence: 0, snapshot, updates: [] };
        return state;
      }),
      appendUpdate: jest.fn(async (_documentId, update, _updateHash) => {
        if (!state) {
          throw new Error('State must be initialized');
        }

        const sequence = state.sequence + 1;
        state = {
          ...state,
          sequence,
          updates: [...state.updates, { sequence, update }],
        };
        return sequence;
      }),
      saveProjection: jest.fn().mockResolvedValue(undefined),
      compactState: jest.fn().mockResolvedValue(undefined),
    };

    return repository;
  }

  function createProjector() {
    const projector: jest.Mocked<DocumentCollaborationProjector> = {
      createDocument: jest.fn(async (_content: unknown[], _title: string) => {
        const document = new Yjs.Doc();
        document.getText('content').insert(0, 'Initial content');
        document.getMap('meta').set('title', 'Initial title');
        return document;
      }),
      project: jest.fn(async (document) => ({
        content: [{
          type: 'paragraph',
          content: document.getText('content').toString(),
        }],
        title: (document.getMap('meta').get('title') as string | undefined) ?? 'Untitled',
      })),
    };

    return projector;
  }

  function createReferenceSyncService() {
    return {
      syncReferencedTitle: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<DocumentCollaborationReferenceSyncService>;
  }

  it('migrates existing BlockNote content and returns the missing Yjs state', async () => {
    const repository = createRepository();
    const projector = createProjector();
    const service = new DocumentCollaborationService(
      repository,
      new DocumentAccessResolver(),
      projector,
      new DocumentSubdocContentService(),
      createReferenceSyncService(),
    );
    const clientDocument = new Yjs.Doc();

    const result = await service.synchronize(
      'document-1',
      user,
      Yjs.encodeStateVector(clientDocument),
    );

    Yjs.applyUpdate(clientDocument, result.update);
    expect(clientDocument.getText('content').toString()).toBe('Initial content');
    expect(clientDocument.getMap('meta').get('title')).toBe('Initial title');
    expect(repository.initializeState).toHaveBeenCalledTimes(1);
    expect(projector.createDocument).toHaveBeenCalledWith([
      { type: 'paragraph', content: 'Initial content' },
    ], 'Initial title');
    expect(result.canEdit).toBe(true);
  });

  it('persists an update and materializes the merged BlockNote projection', async () => {
    const repository = createRepository();
    const projector = createProjector();
    const service = new DocumentCollaborationService(
      repository,
      new DocumentAccessResolver(),
      projector,
      new DocumentSubdocContentService(),
      createReferenceSyncService(),
    );
    const clientDocument = new Yjs.Doc();
    const synchronized = await service.synchronize(
      'document-1',
      user,
      Yjs.encodeStateVector(clientDocument),
    );
    Yjs.applyUpdate(clientDocument, synchronized.update);

    const stateVector = Yjs.encodeStateVector(clientDocument);
    clientDocument.getText('content').insert(0, 'Updated content');
    clientDocument.getMap('meta').set('title', 'Updated title');
    const update = Yjs.encodeStateAsUpdate(clientDocument, stateVector);

    const result = await service.applyUpdate('document-1', user, update);

    expect(result.sequence).toBe(1);
    expect(repository.appendUpdate).toHaveBeenCalledWith(
      'document-1',
      update,
      createHash('sha256').update(update).digest('hex'),
    );
    expect(repository.saveProjection).toHaveBeenCalledWith(
      'document-1',
      1,
      'Updated title',
      expect.arrayContaining([
        expect.objectContaining({ type: 'paragraph' }),
      ]),
      [],
      'user-1',
    );
  });

  it('syncs referenced collaborative documents when the title changes', async () => {
    const repository = createRepository();
    const projector = createProjector();
    const referenceSyncService = createReferenceSyncService();
    const service = new DocumentCollaborationService(
      repository,
      new DocumentAccessResolver(),
      projector,
      new DocumentSubdocContentService(),
      referenceSyncService,
    );
    const clientDocument = new Yjs.Doc();
    const synchronized = await service.synchronize(
      'document-1',
      user,
      Yjs.encodeStateVector(clientDocument),
    );
    Yjs.applyUpdate(clientDocument, synchronized.update);

    clientDocument.getMap('meta').set('title', 'Updated title');
    const update = Yjs.encodeStateAsUpdate(
      clientDocument,
      synchronized.serverStateVector,
    );

    await service.applyUpdate('document-1', user, update);

    expect(referenceSyncService.syncReferencedTitle).toHaveBeenCalledWith({
      targetDocumentId: 'document-1',
      title: 'Updated title',
      updatedByUserId: 'user-1',
      workspaceId: 'workspace-1',
    });
  });

  it('does not expose an update when persistence fails', async () => {
    const repository = createRepository();
    const service = new DocumentCollaborationService(
      repository,
      new DocumentAccessResolver(),
      createProjector(),
      new DocumentSubdocContentService(),
      createReferenceSyncService(),
    );
    const editingDocument = new Yjs.Doc();
    const synchronized = await service.synchronize(
      'document-1',
      user,
      Yjs.encodeStateVector(editingDocument),
    );
    Yjs.applyUpdate(editingDocument, synchronized.update);

    const stateVector = Yjs.encodeStateVector(editingDocument);
    editingDocument.getText('content').insert(
      editingDocument.getText('content').length,
      ' changed',
    );
    const update = Yjs.encodeStateAsUpdate(editingDocument, stateVector);
    repository.appendUpdate.mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(
      service.applyUpdate('document-1', user, update),
    ).rejects.toThrow('storage unavailable');

    const freshDocument = new Yjs.Doc();
    const afterFailure = await service.synchronize(
      'document-1',
      user,
      Yjs.encodeStateVector(freshDocument),
    );
    Yjs.applyUpdate(freshDocument, afterFailure.update);

    expect(freshDocument.getText('content').toString()).toBe('Initial content');
    expect(repository.saveProjection).not.toHaveBeenCalled();
  });

  it('does not persist an update when the projected BlockNote document is invalid', async () => {
    const repository = createRepository();
    const projector = createProjector();
    projector.project.mockRejectedValueOnce(new Error('invalid ydoc'));
    const service = new DocumentCollaborationService(
      repository,
      new DocumentAccessResolver(),
      projector,
      new DocumentSubdocContentService(),
      createReferenceSyncService(),
    );

    await service.synchronize(
      'document-1',
      user,
      Yjs.encodeStateVector(new Yjs.Doc()),
    );

    const updateDocument = new Yjs.Doc();
    updateDocument.getText('content').insert(0, 'Updated content');
    const update = Yjs.encodeStateAsUpdate(updateDocument);

    await expect(
      service.applyUpdate('document-1', user, update),
    ).rejects.toThrow('invalid ydoc');

    expect(repository.appendUpdate).not.toHaveBeenCalled();
    expect(repository.saveProjection).not.toHaveBeenCalled();
  });

  it('rebuilds unreadable persisted collaboration state from fallback content', async () => {
    const repository = createRepository();
    const projector = createProjector();
    const corruptedDocument = new Yjs.Doc();
    repository.initializeState.mockImplementationOnce(async (_documentId, snapshot) => {
      const state = { sequence: 0, snapshot, updates: [] };
      repository.loadState.mockResolvedValue(state);
      return state;
    });

    await repository.initializeState('document-1', Yjs.encodeStateAsUpdate(corruptedDocument));
    projector.project.mockRejectedValueOnce(new Error('corrupted state'));

    const service = new DocumentCollaborationService(
      repository,
      new DocumentAccessResolver(),
      projector,
      new DocumentSubdocContentService(),
      createReferenceSyncService(),
    );

    const synchronized = await service.synchronize(
      'document-1',
      user,
      Yjs.encodeStateVector(new Yjs.Doc()),
    );

    expect(repository.replaceState).toHaveBeenCalledTimes(1);
    expect(synchronized.canEdit).toBe(true);
  });

  it('rebuilds persisted collaboration state when stored Yjs updates cannot be applied', async () => {
    const repository = createRepository();
    const projector = createProjector();

    repository.loadState.mockResolvedValue({
      sequence: 3,
      snapshot: new Uint8Array([1, 2, 3]),
      updates: [],
    });

    const service = new DocumentCollaborationService(
      repository,
      new DocumentAccessResolver(),
      projector,
      new DocumentSubdocContentService(),
      createReferenceSyncService(),
    );

    const synchronized = await service.synchronize(
      'document-1',
      user,
      Yjs.encodeStateVector(new Yjs.Doc()),
    );

    expect(repository.replaceState).toHaveBeenCalledTimes(1);
    expect(synchronized.canEdit).toBe(true);
  });

  it('rejects updates from users without edit access', async () => {
    const repository = createRepository();
    repository.getAccess.mockResolvedValue({
      content: [],
      title: 'Untitled',
      documentOwnerUserId: 'another-user',
      documentTeamspaceId: 'teamspace-1',
      workspaceId: 'workspace-1',
      workspaceRole: WorkspaceRole.MEMBER,
    });
    const service = new DocumentCollaborationService(
      repository,
      new DocumentAccessResolver(),
      createProjector(),
      new DocumentSubdocContentService(),
      createReferenceSyncService(),
    );

    await expect(
      service.applyUpdate('document-1', user, new Uint8Array([0])),
    ).rejects.toBeInstanceOf(DocumentCollaborationPermissionDeniedError);
  });
});
