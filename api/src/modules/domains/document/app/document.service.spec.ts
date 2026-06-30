import type { EntityManager } from '@mikro-orm/postgresql';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { UserStatus } from '~/modules/domains/auth/domain/enums/user-status.enum';
import { WorkspaceRole } from '../../workspace/domain/enums/workspace-role.enum';
import type { WorkspaceRepository } from '../../workspace/app/workspace.repository';
import { DocumentEntity } from '../infra/persistence/entities/document.entity';
import { DocumentService } from './document.service';

describe('DocumentService', () => {
  const currentUser: AuthenticatedUser = {
    userId: 'user-1',
    email: 'user@example.com',
    status: UserStatus.ACTIVE,
    sessionId: 'session-1',
    roles: [],
    permissions: [],
  };

  function createService() {
    const entityManager = {
      fork: jest.fn(),
    } as unknown as jest.Mocked<EntityManager>;
    const workspaceRepository = {
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
    const auditService = {
      record: jest.fn(),
    };

    return {
      service: new DocumentService(
        entityManager,
        workspaceRepository,
        auditService as never,
      ),
      entityManager,
      workspaceRepository,
    };
  }

  it('lists immediate children with hasChildren metadata', async () => {
    const { service, entityManager, workspaceRepository } = createService();
    const rootDocument = {
      id: 'document-root',
      workspace: { id: 'workspace-1' },
    };
    const childDocuments = [
      {
        id: 'document-b',
        title: 'B',
        workspace: { id: 'workspace-1' },
        teamspace: undefined,
        parentDocument: { id: 'document-root' },
        sortKey: 20,
      },
      {
        id: 'document-a',
        title: 'A',
        workspace: { id: 'workspace-1' },
        teamspace: { id: 'teamspace-1' },
        parentDocument: { id: 'document-root' },
        sortKey: 10,
      },
    ];
    const forkedEntityManager = {
      findOne: jest.fn().mockResolvedValue(rootDocument),
      find: jest.fn().mockResolvedValue(childDocuments),
      count: jest.fn()
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(2),
    };

    entityManager.fork.mockReturnValue(forkedEntityManager as never);

    const result = await service.listChildrenForUser('document-root', currentUser);

    expect(workspaceRepository.findAllForUser).toHaveBeenCalledWith(currentUser.userId);
    expect(forkedEntityManager.find).toHaveBeenCalledWith(DocumentEntity, {
      workspace: 'workspace-1',
      parentDocument: 'document-root',
      archivedAt: null,
    }, {
      populate: ['teamspace', 'parentDocument'],
      orderBy: {
        sortKey: 'asc',
        createdAt: 'asc',
      },
    });
    expect(forkedEntityManager.count).toHaveBeenNthCalledWith(1, DocumentEntity, {
      workspace: 'workspace-1',
      parentDocument: 'document-b',
      archivedAt: null,
    });
    expect(forkedEntityManager.count).toHaveBeenNthCalledWith(2, DocumentEntity, {
      workspace: 'workspace-1',
      parentDocument: 'document-a',
      archivedAt: null,
    });
    expect(result).toEqual([
      {
        id: 'document-b',
        title: 'B',
        teamspaceId: undefined,
        parentDocumentId: 'document-root',
        sortKey: 20,
        hasChildren: false,
      },
      {
        id: 'document-a',
        title: 'A',
        teamspaceId: 'teamspace-1',
        parentDocumentId: 'document-root',
        sortKey: 10,
        hasChildren: true,
      },
    ]);
  });

  it('lists grouped root documents for workspace navigation', async () => {
    const { service, entityManager, workspaceRepository } = createService();
    const forkedEntityManager = {
      findOne: jest.fn(),
      find: jest.fn()
        .mockResolvedValueOnce([
          {
            id: 'teamspace-1',
            name: 'Engineering',
            description: 'Shared docs',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'document-private',
            title: 'Private doc',
            workspace: { id: 'workspace-1' },
            teamspace: undefined,
            parentDocument: undefined,
            sortKey: 10,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'document-teamspace',
            title: 'Shared doc',
            workspace: { id: 'workspace-1' },
            teamspace: { id: 'teamspace-1' },
            parentDocument: undefined,
            sortKey: 20,
          },
        ]),
      count: jest.fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0),
    };

    entityManager.fork.mockReturnValue(forkedEntityManager as never);

    const result = await service.listForWorkspace('workspace-1', currentUser, {
      limit: 50,
    });

    expect(workspaceRepository.findAllForUser).toHaveBeenCalledWith(currentUser.userId);
    expect(forkedEntityManager.find).toHaveBeenNthCalledWith(1, expect.any(Function), {
      workspace: 'workspace-1',
    }, {
      orderBy: {
        name: 'asc',
      },
    });
    expect(forkedEntityManager.find).toHaveBeenNthCalledWith(2, DocumentEntity, {
      workspace: 'workspace-1',
      teamspace: null,
      parentDocument: null,
      archivedAt: null,
    }, {
      populate: ['teamspace', 'parentDocument'],
      orderBy: {
        sortKey: 'asc',
        id: 'asc',
      },
    });
    expect(forkedEntityManager.find).toHaveBeenNthCalledWith(3, DocumentEntity, {
      workspace: 'workspace-1',
      teamspace: 'teamspace-1',
      parentDocument: null,
      archivedAt: null,
    }, {
      populate: ['teamspace', 'parentDocument'],
      orderBy: {
        sortKey: 'asc',
        id: 'asc',
      },
    });
    expect(result).toEqual({
      privateDocuments: {
        items: [
          {
            id: 'document-private',
            title: 'Private doc',
            teamspaceId: undefined,
            parentDocumentId: undefined,
            sortKey: 10,
            hasChildren: true,
          },
        ],
      },
      teamspaces: [
        {
          id: 'teamspace-1',
          name: 'Engineering',
          description: 'Shared docs',
          documents: {
            items: [
              {
                id: 'document-teamspace',
                title: 'Shared doc',
                teamspaceId: 'teamspace-1',
                parentDocumentId: undefined,
                sortKey: 20,
                hasChildren: false,
              },
            ],
          },
        },
      ],
    });
  });

  it('creates a new root document ahead of existing siblings', async () => {
    const { service, entityManager } = createService();
    const createdDocument = {
      id: 'document-new',
      workspace: { id: 'workspace-1' },
      teamspace: undefined,
      parentDocument: undefined,
      title: 'Untitled',
      contentFormat: 'blocknote_v1',
      contentJson: [],
      sortKey: 0,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const forkedEntityManager = {
      findOne: jest.fn().mockResolvedValue({
        id: 'document-existing',
        sortKey: 1000,
      }),
      findOneOrFail: jest.fn().mockResolvedValue({ id: 'user-1' }),
      create: jest.fn().mockImplementation((_entity, payload) => ({
        version: 1,
        ...payload,
        ...createdDocument,
        sortKey: payload.sortKey,
      })),
      persistAndFlush: jest.fn().mockResolvedValue(undefined),
    };

    entityManager.fork.mockReturnValue(forkedEntityManager as never);

    const result = await service.createForUser(currentUser, {
      workspaceId: 'workspace-1',
    });

    expect(forkedEntityManager.findOne).toHaveBeenCalledWith(DocumentEntity, {
      workspace: 'workspace-1',
      parentDocument: null,
      teamspace: null,
      archivedAt: null,
    }, {
      orderBy: {
        sortKey: 'asc',
        createdAt: 'asc',
      },
    });
    expect(forkedEntityManager.create).toHaveBeenCalledWith(DocumentEntity, expect.objectContaining({
      sortKey: 0,
    }));
    expect(result.sortKey).toBe(0);
  });

  it('passes a title search filter when listing workspace documents', async () => {
    const { service, entityManager } = createService();
    const forkedEntityManager = {
      findOne: jest.fn(),
      find: jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
      count: jest.fn(),
    };

    entityManager.fork.mockReturnValue(forkedEntityManager as never);

    await service.listForWorkspace('workspace-1', currentUser, {
      limit: 50,
      query: 'page',
    });

    expect(forkedEntityManager.find).toHaveBeenNthCalledWith(2, DocumentEntity, {
      workspace: 'workspace-1',
      teamspace: null,
      parentDocument: null,
      archivedAt: null,
      title: {
        $ilike: '%page%',
      },
    }, {
      populate: ['teamspace', 'parentDocument'],
      orderBy: {
        sortKey: 'asc',
        id: 'asc',
      },
    });
  });

  it('returns the recent document when it is still available', async () => {
    const { service, entityManager } = createService();
    const forkedEntityManager = {
      findOne: jest.fn().mockResolvedValueOnce({
        id: 'document-recent',
      }),
    };

    entityManager.fork.mockReturnValue(forkedEntityManager as never);

    const result = await service.getDefaultDocumentForWorkspace(
      'workspace-1',
      currentUser,
      'document-recent',
    );

    expect(forkedEntityManager.findOne).toHaveBeenCalledWith(DocumentEntity, {
      id: 'document-recent',
      workspace: 'workspace-1',
      archivedAt: null,
    });
    expect(result).toEqual({ documentId: 'document-recent' });
  });

  it('falls back to the first available root document when recent is missing', async () => {
    const { service, entityManager } = createService();
    const forkedEntityManager = {
      findOne: jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'document-first',
        }),
      find: jest.fn(),
    };

    entityManager.fork.mockReturnValue(forkedEntityManager as never);

    const result = await service.getDefaultDocumentForWorkspace(
      'workspace-1',
      currentUser,
      'document-missing',
    );

    expect(forkedEntityManager.findOne).toHaveBeenNthCalledWith(2, DocumentEntity, {
      workspace: 'workspace-1',
      teamspace: null,
      parentDocument: null,
      archivedAt: null,
    }, {
      orderBy: {
        sortKey: 'asc',
        createdAt: 'asc',
      },
    });
    expect(result).toEqual({ documentId: 'document-first' });
  });
});
