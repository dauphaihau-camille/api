import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { UserStatus } from '~/domains/auth/domain/enums/user-status.enum';
import type { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import type { DocumentNavigationQueryRepository } from '../ports/document-navigation-query.repository';
import type { DocumentCommandRepository } from '../ports/document-command.repository';
import type { DocumentTreeService } from '../services/document-tree.service';
import type { DocumentSubdocContentService } from '../services/document-subdoc-content.service';
import { DEFAULT_DOCUMENT_CONTENT } from '../constants/document.constants';
import { CreateSubdocCommandUseCase } from './create-subdoc-command.use-case';
import type { SyncDocumentSubdocReferencesUseCase } from './sync-document-subdoc-references.use-case';

describe('CreateSubdocCommandUseCase', () => {
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

  function createSubdocContentService() {
    return {
      insertSubdocBlock: jest.fn(),
    } as unknown as jest.Mocked<DocumentSubdocContentService>;
  }

  function createSyncDocumentSubdocReferencesUseCase() {
    return {
      execute: jest.fn(),
    } as unknown as jest.Mocked<SyncDocumentSubdocReferencesUseCase>;
  }

  it('creates a child document and updates the parent content in one command', async () => {
    const workspaceRepository = createWorkspaceRepository();
    const navigationQueryRepository = createNavigationQueryRepository();
    const commandRepository = createCommandRepository();
    const treeService = createTreeService();
    const subdocContentService = createSubdocContentService();
    const syncDocumentSubdocReferencesUseCase = createSyncDocumentSubdocReferencesUseCase();
    const auditService = {
      record: jest.fn(),
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
        id: 'existing-block', type: 'paragraph', props: {}, children: [],
      }],
      searchText: '',
      sortKey: 9,
      ownerUser: { id: 'user-1' },
      updatedBy: { id: 'user-0' },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const unsavedParentContent = [
      {
        id: 'existing-block',
        type: 'paragraph',
        props: {},
        children: [],
      },
      {
        id: 'new-empty-block',
        type: 'paragraph',
        props: {},
        children: [],
      },
    ];
    const childDocument = {
      id: 'child-1',
      publicId: 'public-child-1',
      version: 1,
      workspace: { id: 'workspace-1' },
      teamspace: undefined,
      parentDocument: { id: 'parent-1' },
      title: 'Untitled',
      contentFormat: 'blocknote_v1',
      contentJson: DEFAULT_DOCUMENT_CONTENT,
      searchText: '',
      sortKey: 17,
      createdBy: { id: 'user-1' },
      ownerUser: { id: 'user-1' },
      updatedBy: { id: 'user-1' },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const nextParentContent = [
      ...parentDocument.contentJson,
      {
        id: 'subdoc-block',
        type: 'subdoc',
        props: {
          documentId: childDocument.id,
        },
        children: [],
      },
    ];

    navigationQueryRepository.findDocument.mockResolvedValue(parentDocument as never);
    subdocContentService.insertSubdocBlock.mockReturnValue(nextParentContent);
    commandRepository.withTransaction.mockImplementation(async (callback) =>
      callback({
        commandRepository: {
          findDocument: jest.fn().mockResolvedValue(parentDocument),
          lockDocumentVersion: jest.fn(),
          createDocument: jest.fn().mockReturnValue(childDocument),
          assignUpdatedByUser: jest.fn((document) => {
            document.updatedBy = { id: currentUser.userId };
          }),
          saveDocuments: jest.fn(),
          flush: jest.fn(),
        },
        subdocReferenceRepository: { id: 'subdoc-repo' },
      } as never));

    const useCase = new CreateSubdocCommandUseCase(
      auditService as never,
      workspaceRepository,
      commandRepository,
      navigationQueryRepository,
      subdocContentService,
      syncDocumentSubdocReferencesUseCase,
      treeService,
    );

    const result = await useCase.execute(currentUser, 'parent-1', {
      anchorBlockId: 'anchor-block-1',
      slashCommandText: '/doc',
      version: 3,
      content: unsavedParentContent,
    });

    expect(subdocContentService.insertSubdocBlock).toHaveBeenCalledWith(
      unsavedParentContent,
      childDocument,
      'anchor-block-1',
      '/doc',
    );
    expect(parentDocument.contentJson).toEqual(nextParentContent);
    expect(parentDocument.updatedBy).toEqual({ id: currentUser.userId });
    expect(syncDocumentSubdocReferencesUseCase.execute).toHaveBeenNthCalledWith(
      1,
      childDocument,
      { id: 'subdoc-repo' },
    );
    expect(syncDocumentSubdocReferencesUseCase.execute).toHaveBeenNthCalledWith(
      2,
      parentDocument,
      { id: 'subdoc-repo' },
    );
    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'document.created',
      resourceId: 'child-1',
      metadata: expect.objectContaining({
        command: 'create-subdoc',
      }),
    }));
    expect(result.parentDocument.id).toBe('parent-1');
    expect(result.childDocument.id).toBe('child-1');
  });
});
