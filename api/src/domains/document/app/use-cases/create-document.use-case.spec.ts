import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { UserStatus } from '~/domains/auth/domain/enums/user-status.enum';
import { WorkspaceBlockLimitReachedError } from '~/domains/subscription/app/errors/subscription-app.error';
import type { BlockCreationGateService } from '~/domains/subscription/app/services/block-creation-gate.service';
import type { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import type { DocumentCommandRepository } from '../ports/document-command.repository';
import type { DocumentTreeService } from '../services/document-tree.service';
import { CreateDocumentUseCase } from './create-document.use-case';
import type { SyncDocumentSubdocReferencesUseCase } from './sync-document-subdoc-references.use-case';

describe('CreateDocumentUseCase', () => {
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
      findTeamspaceByIdInWorkspace: jest.fn(),
      withTransaction: jest.fn(),
    } as unknown as jest.Mocked<DocumentCommandRepository>;
  }

  function createTreeService() {
    return {
      resolveSortKeyForCreate: jest.fn().mockResolvedValue(17),
    } as unknown as jest.Mocked<DocumentTreeService>;
  }

  function createSyncDocumentSubdocReferencesUseCase() {
    return {
      execute: jest.fn(),
    } as unknown as jest.Mocked<SyncDocumentSubdocReferencesUseCase>;
  }

  function createBlockCreationGateService() {
    return {
      assertCanCreateBlocks: jest.fn(),
    } as unknown as jest.Mocked<BlockCreationGateService>;
  }

  it('creates a root document without a parent reference', async () => {
    const workspaceRepository = createWorkspaceRepository();
    const commandRepository = createCommandRepository();
    const treeService = createTreeService();
    const syncDocumentSubdocReferencesUseCase = createSyncDocumentSubdocReferencesUseCase();
    const auditService = {
      record: jest.fn(),
    };
    const blockCreationGateService = createBlockCreationGateService();

    const createdDocument = {
      id: 'doc-1',
      publicId: 'public-doc-1',
      version: 1,
      workspace: { id: 'workspace-1' },
      teamspace: undefined,
      parentDocument: undefined,
      title: 'Untitled',
      contentFormat: 'blocknote_v1',
      contentJson: [],
      searchText: '',
      sortKey: 17,
      createdBy: { id: 'user-1' },
      ownerUser: { id: 'user-1' },
      updatedBy: { id: 'user-1' },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    commandRepository.withTransaction.mockImplementation(async (callback) =>
      callback({
        commandRepository: {
          createDocument: jest.fn().mockReturnValue(createdDocument),
          saveDocument: jest.fn(),
          flush: jest.fn(),
        },
        subdocReferenceRepository: { id: 'subdoc-repo' },
      } as never));

    const useCase = new CreateDocumentUseCase(
      auditService as never,
      workspaceRepository,
      commandRepository,
      syncDocumentSubdocReferencesUseCase,
      treeService,
      blockCreationGateService,
    );

    const result = await useCase.execute(currentUser, {
      workspaceId: 'workspace-1',
    });

    expect(syncDocumentSubdocReferencesUseCase.execute).toHaveBeenCalledWith(
      createdDocument,
      { id: 'subdoc-repo' },
    );
    expect(blockCreationGateService.assertCanCreateBlocks).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      newBlockCount: 1,
    });
    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'document.created',
      resourceId: 'doc-1',
    }));
    expect(result.parentDocumentId).toBeUndefined();
  });

  it('does not create a document when the workspace block limit is reached', async () => {
    const workspaceRepository = createWorkspaceRepository();
    const commandRepository = createCommandRepository();
    const treeService = createTreeService();
    const syncDocumentSubdocReferencesUseCase = createSyncDocumentSubdocReferencesUseCase();
    const auditService = {
      record: jest.fn(),
    };
    const blockCreationGateService = createBlockCreationGateService();
    blockCreationGateService.assertCanCreateBlocks.mockRejectedValue(
      new WorkspaceBlockLimitReachedError({
        plan: 'free',
        blockCount: 1000,
        blockLimit: 1000,
        upgradeAvailable: true,
      }),
    );

    const useCase = new CreateDocumentUseCase(
      auditService as never,
      workspaceRepository,
      commandRepository,
      syncDocumentSubdocReferencesUseCase,
      treeService,
      blockCreationGateService,
    );

    await expect(useCase.execute(currentUser, {
      workspaceId: 'workspace-1',
    })).rejects.toBeInstanceOf(WorkspaceBlockLimitReachedError);

    expect(commandRepository.withTransaction).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });
});
