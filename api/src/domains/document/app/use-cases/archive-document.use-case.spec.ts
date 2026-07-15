import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { UserStatus } from '~/domains/auth/domain/enums/user-status.enum';
import type { PublishRepository } from '../../../publish/app/ports/publish.repository';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import type { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import type { DocumentCommandRepository } from '../ports/document-command.repository';
import type { DocumentTreeService } from '../services/document-tree.service';
import type { DocumentSubdocService } from '../services/document-subdoc.service';
import { ArchiveDocumentUseCase } from './archive-document.use-case';

describe('ArchiveDocumentUseCase', () => {
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
      findCurrentUser: jest.fn(),
      saveDocuments: jest.fn(),
      lockDocumentVersion: jest.fn(),
      withTransaction: jest.fn(),
    } as unknown as jest.Mocked<DocumentCommandRepository>;
  }

  function createTreeService() {
    return {
      findDescendants: jest.fn(),
    } as unknown as jest.Mocked<DocumentTreeService>;
  }

  function createSubdocService() {
    return {
      removeArchivedSubdocReferences: jest.fn(),
    } as unknown as jest.Mocked<DocumentSubdocService>;
  }

  function createPublishRepository() {
    return {
      unpublishDocument: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<PublishRepository>;
  }

  it('removes archived subdoc references for the archived subtree', async () => {
    const workspaceRepository = createWorkspaceRepository();
    const commandRepository = createCommandRepository();
    const treeService = createTreeService();
    const subdocService = createSubdocService();
    const publishRepository = createPublishRepository();
    const auditService = {
      record: jest.fn(),
    };
    const jobDispatcher = {
      dispatch: jest.fn(),
    };

    const document = {
      id: 'document-1',
      title: 'Parent',
      workspace: { id: 'workspace-1' },
    };
    const descendant = {
      id: 'document-2',
      title: 'Child',
      workspace: { id: 'workspace-1' },
    };
    const actor = { id: 'user-1' };

    commandRepository.findDocument.mockResolvedValue(document as never);
    treeService.findDescendants.mockResolvedValue([descendant] as never);
    commandRepository.withTransaction.mockImplementation(async (callback) =>
      callback({
        commandRepository: {
          findDocument: jest
            .fn()
            .mockResolvedValueOnce(document)
            .mockResolvedValueOnce(descendant),
          findCurrentUser: jest.fn().mockResolvedValue(actor),
          saveDocuments: commandRepository.saveDocuments,
          lockDocumentVersion: jest.fn(),
        },
        subdocReferenceRepository: { id: 'subdoc-repo' },
      } as never));

    const useCase = new ArchiveDocumentUseCase(
      auditService as never,
      jobDispatcher as never,
      workspaceRepository,
      publishRepository,
      commandRepository,
      treeService,
      subdocService,
    );

    await useCase.execute('document-1', 3, currentUser);

    expect(subdocService.removeArchivedSubdocReferences).toHaveBeenCalledWith([
      document,
      descendant,
    ], { id: 'subdoc-repo' });
    expect(commandRepository.saveDocuments).toHaveBeenCalledWith([
      document,
      descendant,
    ]);
  });
});
