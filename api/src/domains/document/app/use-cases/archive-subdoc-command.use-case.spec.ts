import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { UserStatus } from '~/domains/auth/domain/enums/user-status.enum';
import type { PublishRepository } from '../../../publish/app/ports/publish.repository';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import type { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import type { DocumentCommandRepository } from '../ports/document-command.repository';
import { DocumentAccessResolver } from '../policies/document-access.resolver';
import type { DocumentTreeService } from '../services/document-tree.service';
import type { DocumentSubdocContentService } from '../services/document-subdoc-content.service';
import { ArchiveSubdocCommandUseCase } from './archive-subdoc-command.use-case';
import type { RemoveArchivedSubdocReferencesUseCase } from './remove-archived-subdoc-references.use-case';
import type { SyncDocumentSubdocReferencesUseCase } from './sync-document-subdoc-references.use-case';

describe('ArchiveSubdocCommandUseCase', () => {
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
      assignUpdatedByUser: jest.fn(),
      saveDocuments: jest.fn(),
      lockDocumentVersion: jest.fn(),
      flush: jest.fn(),
      withTransaction: jest.fn(),
    } as unknown as jest.Mocked<DocumentCommandRepository>;
  }

  function createTreeService() {
    return {
      findDescendants: jest.fn(),
    } as unknown as jest.Mocked<DocumentTreeService>;
  }

  function createSubdocContentService() {
    return {
      removeBlocks: jest.fn(),
    } as unknown as jest.Mocked<DocumentSubdocContentService>;
  }

  function createRemoveArchivedSubdocReferencesUseCase() {
    return {
      execute: jest.fn(),
    } as unknown as jest.Mocked<RemoveArchivedSubdocReferencesUseCase>;
  }

  function createSyncDocumentSubdocReferencesUseCase() {
    return {
      execute: jest.fn(),
    } as unknown as jest.Mocked<SyncDocumentSubdocReferencesUseCase>;
  }

  function createPublishRepository() {
    return {
      unpublishDocument: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<PublishRepository>;
  }

  it('archives the child subtree and updates the parent document in one command', async () => {
    const workspaceRepository = createWorkspaceRepository();
    const commandRepository = createCommandRepository();
    const treeService = createTreeService();
    const subdocContentService = createSubdocContentService();
    const removeArchivedSubdocReferencesUseCase = createRemoveArchivedSubdocReferencesUseCase();
    const syncDocumentSubdocReferencesUseCase = createSyncDocumentSubdocReferencesUseCase();
    const publishRepository = createPublishRepository();
    const auditService = {
      record: jest.fn(),
    };
    const jobDispatcher = {
      dispatch: jest.fn(),
    };

    const parentDocument = {
      id: 'parent-1',
      publicId: 'public-parent-1',
      version: 3,
      workspace: { id: 'workspace-1' },
      teamspace: undefined,
      parentDocument: undefined,
      title: 'Parent',
      contentFormat: 'blocknote_v1',
      contentJson: [{
        id: 'subdoc-block',
        type: 'subdoc',
        props: { documentId: 'child-1' },
        children: [],
      }],
      searchText: '',
      sortKey: 9,
      updatedBy: { id: 'user-0' },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const childDocument = {
      id: 'child-1',
      publicId: 'public-child-1',
      version: 1,
      workspace: { id: 'workspace-1' },
      teamspace: undefined,
      parentDocument: { id: 'parent-1' },
      title: 'Child',
      contentFormat: 'blocknote_v1',
      contentJson: [],
      searchText: '',
      sortKey: 17,
      updatedBy: { id: 'user-0' },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const descendant = {
      id: 'child-2',
      workspace: { id: 'workspace-1' },
      parentDocument: { id: 'child-1' },
      updatedBy: { id: 'user-0' },
    };
    const nextParentContent = [{
      id: 'remaining-block',
      type: 'paragraph',
      props: {},
      children: [],
    }];
    const originalParentContent = parentDocument.contentJson;

    commandRepository.findDocument
      .mockResolvedValueOnce(parentDocument as never)
      .mockResolvedValueOnce(childDocument as never);
    treeService.findDescendants.mockResolvedValue([descendant] as never);
    subdocContentService.removeBlocks.mockReturnValue({
      changed: true,
      content: nextParentContent,
    });
    commandRepository.withTransaction.mockImplementation(async (callback) =>
      callback({
        commandRepository: {
          findDocument: jest
            .fn()
            .mockResolvedValueOnce(parentDocument)
            .mockResolvedValueOnce(childDocument)
            .mockResolvedValueOnce(descendant),
          assignUpdatedByUser: jest.fn((document) => {
            document.updatedBy = { id: currentUser.userId };
          }),
          lockDocumentVersion: jest.fn(),
          saveDocuments: commandRepository.saveDocuments,
          flush: commandRepository.flush,
        },
        subdocReferenceRepository: { id: 'subdoc-repo' },
      } as never));

    const useCase = new ArchiveSubdocCommandUseCase(
      auditService as never,
      jobDispatcher as never,
      workspaceRepository,
      new DocumentAccessResolver(),
      publishRepository,
      commandRepository,
      treeService,
      subdocContentService,
      removeArchivedSubdocReferencesUseCase,
      syncDocumentSubdocReferencesUseCase,
    );

    const result = await useCase.execute(currentUser, 'parent-1', {
      subdocumentId: 'child-1',
      version: 3,
    });

    expect(subdocContentService.removeBlocks).toHaveBeenCalledWith(
      originalParentContent,
      new Set(['child-1', 'child-2']),
    );
    expect(parentDocument.contentJson).toEqual(nextParentContent);
    expect(parentDocument.updatedBy).toEqual({ id: currentUser.userId });
    expect(removeArchivedSubdocReferencesUseCase.execute).toHaveBeenCalledWith(
      [childDocument, descendant],
      { id: 'subdoc-repo' },
    );
    expect(syncDocumentSubdocReferencesUseCase.execute).toHaveBeenCalledWith(
      parentDocument,
      { id: 'subdoc-repo' },
    );
    expect(commandRepository.saveDocuments).toHaveBeenCalledWith([
      parentDocument,
      childDocument,
      descendant,
    ]);
    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'document.archived',
      resourceId: 'child-1',
      metadata: expect.objectContaining({
        command: 'archive-subdoc',
        parentDocumentId: 'parent-1',
      }),
    }));
    expect(result.parentDocument.id).toBe('parent-1');
    expect(result.archivedChildDocument.id).toBe('child-1');
  });
});
