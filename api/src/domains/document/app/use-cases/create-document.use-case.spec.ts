import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { UserStatus } from '~/domains/auth/domain/enums/user-status.enum';
import type { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import type { DocumentNavigationQueryRepository } from '../ports/document-navigation-query.repository';
import type { DocumentCommandRepository } from '../ports/document-command.repository';
import type { DocumentTreeService } from '../services/document-tree.service';
import type { DocumentSubdocService } from '../services/document-subdoc.service';
import { CreateDocumentUseCase } from './create-document.use-case';

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

  function createNavigationQueryRepository() {
    return {
      findDocument: jest.fn(),
    } as unknown as jest.Mocked<DocumentNavigationQueryRepository>;
  }

  function createCommandRepository() {
    return {
      withTransaction: jest.fn(),
    } as unknown as jest.Mocked<DocumentCommandRepository>;
  }

  function createTreeService() {
    return {
      resolveSortKeyForCreate: jest.fn().mockResolvedValue(17),
    } as unknown as jest.Mocked<DocumentTreeService>;
  }

  function createSubdocService() {
    return {
      appendSubdocBlock: jest.fn(),
      syncSubdocReferencesForDoc: jest.fn(),
    } as unknown as jest.Mocked<DocumentSubdocService>;
  }

  it('creates a child document without mutating parent content', async () => {
    const workspaceRepository = createWorkspaceRepository();
    const navigationQueryRepository = createNavigationQueryRepository();
    const commandRepository = createCommandRepository();
    const treeService = createTreeService();
    const subdocService = createSubdocService();
    const auditService = {
      record: jest.fn(),
    };

    const parentDocument = {
      id: 'parent-1',
      workspace: { id: 'workspace-1' },
      teamspace: undefined,
      contentJson: [{
        id: 'existing-block', type: 'paragraph', props: {}, children: [], 
      }],
      updatedBy: { id: 'user-0' },
    };
    const childDocument = {
      id: 'child-1',
      publicId: 'public-child-1',
      version: 1,
      workspace: { id: 'workspace-1' },
      teamspace: undefined,
      parentDocument: { id: 'parent-1' },
      title: 'Untitled',
      contentFormat: 'blocknote_v1',
      contentJson: [],
      searchText: '',
      sortKey: 17,
      createdBy: { id: 'user-1' },
      updatedBy: { id: 'user-1' },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    navigationQueryRepository.findDocument.mockResolvedValue(parentDocument as never);
    commandRepository.withTransaction.mockImplementation(async (callback) =>
      callback({
        commandRepository: {
          findDocument: jest.fn().mockResolvedValue(parentDocument),
          createDocument: jest.fn().mockReturnValue(childDocument),
          saveDocument: jest.fn(),
          flush: jest.fn(),
        },
        subdocReferenceRepository: { id: 'subdoc-repo' },
      } as never));

    const useCase = new CreateDocumentUseCase(
      auditService as never,
      workspaceRepository,
      commandRepository,
      navigationQueryRepository,
      subdocService,
      treeService,
    );

    const result = await useCase.execute(currentUser, {
      workspaceId: 'workspace-1',
      parentDocumentId: 'parent-1',
    });

    expect(subdocService.appendSubdocBlock).not.toHaveBeenCalled();
    expect(parentDocument.contentJson).toEqual([{
      id: 'existing-block', type: 'paragraph', props: {}, children: [],
    }]);
    expect(parentDocument.updatedBy).toEqual({ id: 'user-0' });
    expect(subdocService.syncSubdocReferencesForDoc).toHaveBeenCalledWith(
      childDocument,
      { id: 'subdoc-repo' },
    );
    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'document.created',
      resourceId: 'child-1',
    }));
    expect(result.parentDocumentId).toBe('parent-1');
  });
});
