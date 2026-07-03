import type { EntityManager } from '@mikro-orm/postgresql';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { UserStatus } from '~/modules/domains/auth/domain/enums/user-status.enum';
import { WorkspaceRole } from '../../workspace/domain/enums/workspace-role.enum';
import type { WorkspaceRepository } from '../../workspace/app/workspace.repository';
import { DocumentEntity } from '../infra/persistence/entities/document.entity';
import { DocumentSubdocReferenceEntity } from '../infra/persistence/entities/document-subdoc-reference.entity';
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
      transactional: jest.fn(),
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
        publicId: 'public-b',
        title: 'B',
        workspace: { id: 'workspace-1' },
        teamspace: undefined,
        parentDocument: { id: 'document-root' },
        contentJson: [{ type: 'paragraph', content: [] }],
        sortKey: 20,
      },
      {
        id: 'document-a',
        publicId: 'public-a',
        title: 'A',
        workspace: { id: 'workspace-1' },
        teamspace: { id: 'teamspace-1' },
        parentDocument: { id: 'document-root' },
        contentJson: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
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
        publicId: 'public-b',
        title: 'B',
        teamspaceId: undefined,
        parentDocumentId: 'document-root',
        sortKey: 20,
        hasChildren: false,
        hasContent: false,
      },
      {
        id: 'document-a',
        publicId: 'public-a',
        title: 'A',
        teamspaceId: 'teamspace-1',
        parentDocumentId: 'document-root',
        sortKey: 10,
        hasChildren: true,
        hasContent: true,
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
            publicId: 'public-private',
            title: 'Private doc',
            workspace: { id: 'workspace-1' },
            teamspace: undefined,
            parentDocument: undefined,
            contentJson: [{ type: 'paragraph', content: [] }],
            sortKey: 10,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'document-teamspace',
            publicId: 'public-teamspace',
            title: 'Shared doc',
            workspace: { id: 'workspace-1' },
            teamspace: { id: 'teamspace-1' },
            parentDocument: undefined,
            contentJson: [{ type: 'paragraph', content: [{ type: 'text', text: 'Spec' }] }],
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
                publicId: 'public-private',
                title: 'Private doc',
            teamspaceId: undefined,
            parentDocumentId: undefined,
            sortKey: 10,
            hasChildren: true,
            hasContent: false,
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
                publicId: 'public-teamspace',
                title: 'Shared doc',
                teamspaceId: 'teamspace-1',
                parentDocumentId: undefined,
                sortKey: 20,
                hasChildren: false,
                hasContent: true,
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
      find: jest.fn().mockResolvedValue([]),
      findOneOrFail: jest.fn().mockResolvedValue({ id: 'user-1' }),
      create: jest.fn().mockImplementation((_entity, payload) => ({
        version: 1,
        ...payload,
        ...createdDocument,
        sortKey: payload.sortKey,
      })),
      persist: jest.fn(),
      remove: jest.fn(),
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

  it('duplicates a document subtree and remaps embedded subdoc references', async () => {
    const { service, entityManager, workspaceRepository } = createService();
    const actor = { id: 'user-1' };
    const now = new Date('2026-01-01T00:00:00.000Z');
    const sourceRootDocument = {
      id: 'document-root',
      publicId: 'public-root',
      version: 3,
      workspace: { id: 'workspace-1' },
      teamspace: undefined,
      parentDocument: undefined,
      title: 'Parent',
      contentFormat: 'blocknote_v1',
      contentJson: [
        {
          id: 'block-1',
          type: 'subpage',
          props: {
            documentId: 'document-child',
            publicId: 'public-child',
            workspaceId: 'workspace-1',
            title: 'Child',
          },
        },
      ],
      sortKey: 100,
      archivedAt: undefined,
      createdAt: now,
      updatedAt: now,
      createdBy: actor,
      updatedBy: actor,
    };
    const sourceChildDocument = {
      id: 'document-child',
      publicId: 'public-child',
      version: 2,
      workspace: { id: 'workspace-1' },
      teamspace: undefined,
      parentDocument: { id: 'document-root' },
      title: 'Child',
      contentFormat: 'blocknote_v1',
      contentJson: [
        {
          id: 'block-2',
          type: 'subpage',
          props: {
            documentId: 'document-grandchild',
            publicId: 'public-grandchild',
            workspaceId: 'workspace-1',
            title: 'Grandchild',
          },
        },
        {
          id: 'block-3',
          type: 'subpage',
          props: {
            documentId: 'document-external',
            publicId: 'public-external',
            workspaceId: 'workspace-1',
            title: 'External',
          },
        },
      ],
      sortKey: 200,
      archivedAt: undefined,
      createdAt: now,
      updatedAt: now,
      createdBy: actor,
      updatedBy: actor,
    };
    const sourceGrandchildDocument = {
      id: 'document-grandchild',
      publicId: 'public-grandchild',
      version: 1,
      workspace: { id: 'workspace-1' },
      teamspace: undefined,
      parentDocument: { id: 'document-child' },
      title: 'Grandchild',
      contentFormat: 'blocknote_v1',
      contentJson: [{ type: 'paragraph', content: [] }],
      sortKey: 300,
      archivedAt: undefined,
      createdAt: now,
      updatedAt: now,
      createdBy: actor,
      updatedBy: actor,
    };
    const sourceUnreferencedChildDocument = {
      id: 'document-unreferenced-child',
      publicId: 'public-unreferenced-child',
      version: 1,
      workspace: { id: 'workspace-1' },
      teamspace: undefined,
      parentDocument: { id: 'document-root' },
      title: 'Loose child',
      contentFormat: 'blocknote_v1',
      contentJson: [{ type: 'paragraph', content: [] }],
      sortKey: 400,
      archivedAt: undefined,
      createdAt: now,
      updatedAt: now,
      createdBy: actor,
      updatedBy: actor,
    };
    const outerEntityManager = {
      findOne: jest.fn().mockResolvedValue(sourceRootDocument),
    };
    const createdDocuments: Array<Record<string, unknown>> = [];
    const createdReferences: unknown[] = [];
    const transactionalEntityManager = {
      findOne: jest.fn().mockImplementation(async (entity, where) => {
        if (entity !== DocumentEntity) {
          return null;
        }

        if (
          '$or' in where
          || (where.id === 'document-root' && where.workspace === 'workspace-1' && where.archivedAt === null)
        ) {
          return sourceRootDocument;
        }

        if (
          where.workspace === 'workspace-1'
          && where.parentDocument === null
          && where.teamspace === null
          && where.archivedAt === null
        ) {
          return {
            id: 'document-existing',
            sortKey: 1000,
          };
        }

        return null;
      }),
      find: jest.fn().mockImplementation(async (entity, where) => {
        if (entity === DocumentEntity) {
          const parentDocumentFilter = where.parentDocument as
            | { $in: string[] }
            | undefined;

          if (!parentDocumentFilter) {
            return [];
          }

          const matchingParentIds = new Set(parentDocumentFilter.$in);

          return [
            sourceChildDocument,
            sourceGrandchildDocument,
            sourceUnreferencedChildDocument,
          ].filter((document) => matchingParentIds.has(document.parentDocument?.id ?? ''));
        }

        if (entity === DocumentSubdocReferenceEntity) {
          return [];
        }

        return [];
      }),
      findOneOrFail: jest.fn().mockResolvedValue(actor),
      create: jest.fn().mockImplementation((entity, payload) => {
        if (entity === DocumentEntity) {
          const createdDocument = {
            id: `duplicate-${createdDocuments.length + 1}`,
            publicId: `public-duplicate-${createdDocuments.length + 1}`,
            version: 1,
            archivedAt: undefined,
            createdAt: now,
            updatedAt: now,
            ...payload,
          };
          createdDocuments.push(createdDocument);

          return createdDocument;
        }

        createdReferences.push(payload);
        return payload;
      }),
      persist: jest.fn(),
      persistAndFlush: jest.fn().mockResolvedValue(undefined),
      flush: jest.fn().mockResolvedValue(undefined),
    };

    entityManager.fork.mockReturnValue(outerEntityManager as never);
    entityManager.transactional.mockImplementation(async (callback) =>
      callback(transactionalEntityManager as never));

    const result = await service.duplicateForUser('document-root', currentUser);

    expect(workspaceRepository.findAllForUser).toHaveBeenCalledWith(currentUser.userId);
    expect(createdDocuments).toHaveLength(4);
    expect(createdDocuments[0]).toEqual(expect.objectContaining({
      parentDocument: undefined,
      title: 'Parent (1)',
      sortKey: 0,
    }));
    expect(createdDocuments[1]).toEqual(expect.objectContaining({
      parentDocument: createdDocuments[0],
      title: 'Child (1)',
      sortKey: 200,
    }));
    expect(createdDocuments[2]).toEqual(expect.objectContaining({
      parentDocument: createdDocuments[0],
      title: 'Loose child (1)',
      sortKey: 400,
    }));
    expect(createdDocuments[3]).toEqual(expect.objectContaining({
      parentDocument: createdDocuments[1],
      title: 'Grandchild (1)',
      sortKey: 300,
    }));
    expect(createdDocuments[0].contentJson).toEqual([
      {
        id: 'block-1',
        type: 'subpage',
        props: {
          documentId: 'duplicate-2',
          publicId: 'public-duplicate-2',
          workspaceId: 'workspace-1',
          title: 'Child (1)',
        },
      },
      {
        id: expect.any(String),
        type: 'subpage',
        props: {
          documentId: 'duplicate-3',
          publicId: 'public-duplicate-3',
          workspaceId: 'workspace-1',
          title: 'Loose child (1)',
        },
        children: [],
      },
    ]);
    expect(createdDocuments[1].contentJson).toEqual([
      {
        id: 'block-2',
        type: 'subpage',
        props: {
          documentId: 'duplicate-4',
          publicId: 'public-duplicate-4',
          workspaceId: 'workspace-1',
          title: 'Grandchild (1)',
        },
      },
      {
        id: 'block-3',
        type: 'subpage',
        props: {
          documentId: 'document-external',
          publicId: 'public-external',
          workspaceId: 'workspace-1',
          title: 'External',
        },
      },
    ]);
    expect(createdReferences).toEqual(expect.arrayContaining([
      {
        workspace: 'workspace-1',
        sourceDocument: 'duplicate-1',
        targetDocument: 'duplicate-2',
      },
      {
        workspace: 'workspace-1',
        sourceDocument: 'duplicate-2',
        targetDocument: 'duplicate-4',
      },
      {
        workspace: 'workspace-1',
        sourceDocument: 'duplicate-2',
        targetDocument: 'document-external',
      },
      {
        workspace: 'workspace-1',
        sourceDocument: 'duplicate-1',
        targetDocument: 'duplicate-3',
      },
    ]));
    expect(result).toEqual(expect.objectContaining({
      id: 'duplicate-1',
      title: 'Parent (1)',
      parentDocumentId: undefined,
    }));
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

  it('syncs the subdoc reference index when document content changes', async () => {
    const { service, entityManager } = createService();
    const actor = { id: 'user-1' };
    const documentToUpdate = {
      id: 'document-parent',
      version: 2,
      workspace: { id: 'workspace-1' },
      teamspace: undefined,
      parentDocument: undefined,
      title: 'Parent',
      contentFormat: 'blocknote_v1',
      contentJson: [{ type: 'paragraph', content: [] }],
      sortKey: 10,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      createdBy: actor,
      updatedBy: actor,
    };
    const staleReference = {
      id: 'reference-stale',
      workspace: { id: 'workspace-1' },
      sourceDocument: { id: 'document-parent' },
      targetDocument: { id: 'document-stale' },
    };
    const createdReferences: unknown[] = [];
    const forkedEntityManager = {
      findOne: jest.fn().mockResolvedValue(documentToUpdate),
      find: jest.fn().mockResolvedValue([staleReference]),
      findOneOrFail: jest.fn().mockResolvedValue(actor),
      lock: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockImplementation((_entity, payload) => {
        createdReferences.push(payload);
        return payload;
      }),
      persist: jest.fn(),
      remove: jest.fn(),
      persistAndFlush: jest.fn().mockResolvedValue(undefined),
    };

    entityManager.fork.mockReturnValue(forkedEntityManager as never);

    await service.updateForUser('document-parent', currentUser, {
      version: 2,
      content: [
        {
          id: 'block-1',
          type: 'subpage',
          props: {
            documentId: 'document-child',
            workspaceId: 'workspace-1',
            title: 'Child',
          },
        },
        {
          id: 'block-2',
          type: 'paragraph',
          children: [
            {
              id: 'block-3',
              type: 'subpage',
              props: {
                documentId: 'document-child',
                workspaceId: 'workspace-1',
                title: 'Child duplicate',
              },
            },
          ],
        },
      ],
    });

    expect(forkedEntityManager.find).toHaveBeenCalledWith(DocumentSubdocReferenceEntity, {
      sourceDocument: 'document-parent',
    }, {
      populate: ['workspace', 'sourceDocument', 'targetDocument'],
    });
    expect(forkedEntityManager.remove).toHaveBeenCalledWith(staleReference);
    expect(forkedEntityManager.create).toHaveBeenCalledWith(DocumentSubdocReferenceEntity, {
      workspace: 'workspace-1',
      sourceDocument: 'document-parent',
      targetDocument: 'document-child',
    });
    expect(forkedEntityManager.persist).toHaveBeenCalledWith(createdReferences);
  });

  it('updates stored subdoc block titles when a referenced doc title changes', async () => {
    const { service, entityManager } = createService();
    const actor = { id: 'user-1' };
    const documentToRename = {
      id: 'document-child',
      version: 3,
      workspace: { id: 'workspace-1' },
      teamspace: undefined,
      parentDocument: { id: 'document-parent' },
      title: 'Untitled',
      contentFormat: 'blocknote_v1',
      contentJson: [{ type: 'paragraph', content: [] }],
      sortKey: 20,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      createdBy: actor,
      updatedBy: actor,
    };
    const referencingDocument = {
      id: 'document-parent',
      version: 1,
      workspace: { id: 'workspace-1' },
      teamspace: undefined,
      parentDocument: undefined,
      title: 'Parent',
      contentFormat: 'blocknote_v1',
      contentJson: [
        {
          id: 'block-1',
          type: 'subpage',
          props: {
            documentId: 'document-child',
            workspaceId: 'workspace-1',
            title: 'Untitled',
          },
        },
      ],
      sortKey: 10,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      createdBy: actor,
      updatedBy: actor,
    };
    const subdocReference = {
      id: 'reference-1',
      workspace: { id: 'workspace-1' },
      sourceDocument: referencingDocument,
      targetDocument: documentToRename,
    };
    const forkedEntityManager = {
      findOne: jest.fn()
        .mockResolvedValueOnce(documentToRename),
      find: jest.fn().mockResolvedValue([subdocReference]),
      findOneOrFail: jest.fn().mockResolvedValue(actor),
      lock: jest.fn().mockResolvedValue(undefined),
      persistAndFlush: jest.fn().mockResolvedValue(undefined),
    };

    entityManager.fork.mockReturnValue(forkedEntityManager as never);

    await service.updateForUser('document-child', currentUser, {
      version: 3,
      title: 'Sub doc 4',
    });

    expect(forkedEntityManager.find).toHaveBeenCalledWith(DocumentSubdocReferenceEntity, {
      targetDocument: 'document-child',
    }, {
      populate: ['sourceDocument', 'sourceDocument.workspace', 'sourceDocument.teamspace', 'sourceDocument.parentDocument', 'sourceDocument.createdBy', 'sourceDocument.updatedBy'],
    });
    expect(referencingDocument.contentJson).toEqual([
      {
        id: 'block-1',
        type: 'subpage',
        props: {
          documentId: 'document-child',
          workspaceId: 'workspace-1',
          title: 'Sub doc 4',
        },
      },
    ]);
    expect(referencingDocument.updatedBy).toBe(actor);
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
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'document-first',
        }),
      find: jest.fn().mockResolvedValue([]),
    };

    entityManager.fork.mockReturnValue(forkedEntityManager as never);

    const result = await service.getDefaultDocumentForWorkspace(
      'workspace-1',
      currentUser,
      'document-missing',
    );

    expect(forkedEntityManager.findOne).toHaveBeenNthCalledWith(3, DocumentEntity, {
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
