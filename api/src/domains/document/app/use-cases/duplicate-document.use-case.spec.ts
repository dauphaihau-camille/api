import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { UserStatus } from '~/domains/auth/domain/enums/user-status.enum';
import type { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import { DocumentAccessResolver } from '../policies/document-access.resolver';
import type { DocumentCommandRepository } from '../ports/document-command.repository';
import type { DocumentSubdocContentService } from '../services/document-subdoc-content.service';
import type { DocumentTreeService } from '../services/document-tree.service';
import { DuplicateDocumentUseCase } from './duplicate-document.use-case';
import type { SyncDocumentSubdocReferencesUseCase } from './sync-document-subdoc-references.use-case';

describe('DuplicateDocumentUseCase', () => {
  const currentUser: AuthenticatedUser = {
    userId: 'user-1',
    email: 'user@example.com',
    status: UserStatus.ACTIVE,
    sessionId: 'session-1',
    roles: [],
    permissions: [],
  };

  function createWorkspaceRepository() {
    return {
      findAllForUser: jest.fn().mockResolvedValue([
        {
          id: 'workspace-1',
          version: 1,
          slug: 'workspace-1',
          name: 'Workspace 1',
          description: undefined,
          currentUserRole: WorkspaceRole.OWNER,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]),
    } as unknown as jest.Mocked<WorkspaceRepository>;
  }

  function createCommandRepository() {
    return {
      findDocument: jest.fn(),
      withTransaction: jest.fn(),
    } as unknown as jest.Mocked<DocumentCommandRepository>;
  }

  function createTreeService() {
    return {
      findActiveSubtreeDocuments: jest.fn(),
      buildDuplicateTitle: jest.fn((title: string) => `${title} (copy)`),
      resolveSortKeyForCreate: jest.fn().mockResolvedValue(21),
    } as unknown as jest.Mocked<DocumentTreeService>;
  }

  function createSubdocContentService() {
    return {
      replaceReferencesInContent: jest.fn((contentJson: unknown[]) => contentJson),
      appendMissingChildBlocks: jest.fn((contentJson: unknown[]) => contentJson),
      appendSubdocBlock: jest.fn((contentJson: unknown[]) => contentJson),
    } as unknown as jest.Mocked<DocumentSubdocContentService>;
  }

  function createSyncDocumentSubdocReferencesUseCase() {
    return {
      execute: jest.fn(),
    } as unknown as jest.Mocked<SyncDocumentSubdocReferencesUseCase>;
  }

  it('returns the duplicated document with the hydrated owner user', async () => {
    const workspaceRepository = createWorkspaceRepository();
    const commandRepository = createCommandRepository();
    const treeService = createTreeService();
    const subdocContentService = createSubdocContentService();
    const syncDocumentSubdocReferencesUseCase = createSyncDocumentSubdocReferencesUseCase();
    const auditService = {
      record: jest.fn(),
    };
    const documentAccessResolver = new DocumentAccessResolver();

    const sourceDocument = {
      id: 'source-1',
      publicId: 'public-source-1',
      version: 2,
      workspace: { id: 'workspace-1' },
      teamspace: undefined,
      parentDocument: undefined,
      title: 'Launch Plan',
      contentFormat: 'blocknote_v1',
      contentJson: [],
      searchText: '',
      sortKey: 9,
      createdBy: { id: 'user-1' },
      ownerUser: { id: 'user-1', email: 'user@example.com' },
      updatedBy: { id: 'user-1' },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const duplicatedDocument = {
      id: 'duplicate-1',
      publicId: 'public-duplicate-1',
      version: 1,
      workspace: { id: 'workspace-1' },
      teamspace: undefined,
      parentDocument: undefined,
      title: 'Launch Plan (copy)',
      contentFormat: 'blocknote_v1',
      contentJson: [],
      searchText: '',
      sortKey: 21,
      createdBy: { id: 'user-1' },
      ownerUser: { id: 'user-1' },
      updatedBy: { id: 'user-1' },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const hydratedOwner = {
      id: currentUser.userId,
      email: currentUser.email,
      displayName: 'Duplicate Owner',
    };
    const hydratedDuplicatedDocument = {
      ...duplicatedDocument,
      ownerUser: hydratedOwner,
    };

    treeService.findActiveSubtreeDocuments.mockResolvedValue([
      sourceDocument,
    ] as never);
    commandRepository.findDocument.mockImplementation(async (documentId) =>
      (documentId === duplicatedDocument.id
        ? hydratedDuplicatedDocument
        : sourceDocument) as never);
    commandRepository.withTransaction.mockImplementation(async (callback) =>
      callback({
        commandRepository: {
          findDocument: jest.fn(),
          createDocument: jest.fn().mockReturnValue(duplicatedDocument),
          assignUpdatedByUser: jest.fn((document) => {
            document.updatedBy = { id: currentUser.userId };
          }),
          saveDocuments: jest.fn(),
          flush: jest.fn(),
        },
        subdocReferenceRepository: { id: 'subdoc-repo' },
      } as never));

    const useCase = new DuplicateDocumentUseCase(
      auditService as never,
      workspaceRepository,
      documentAccessResolver,
      commandRepository,
      subdocContentService,
      syncDocumentSubdocReferencesUseCase,
      treeService,
    );

    const result = await useCase.execute('source-1', currentUser);

    expect(commandRepository.findDocument).toHaveBeenNthCalledWith(1, 'source-1');
    expect(commandRepository.findDocument).toHaveBeenNthCalledWith(2, 'duplicate-1');
    expect(syncDocumentSubdocReferencesUseCase.execute).toHaveBeenCalledWith(
      duplicatedDocument,
      { id: 'subdoc-repo' },
    );
    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'document.created',
      resourceId: 'duplicate-1',
    }));
    expect(result.id).toBe('duplicate-1');
    expect(result.title).toBe('Launch Plan (copy)');
    expect(result.ownerUser).toEqual(hydratedOwner);
  });
});
