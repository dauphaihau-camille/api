import type { EntityManager } from '@mikro-orm/postgresql';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { UserStatus } from '~/domains/auth/domain/enums/user-status.enum';
import { DocumentFavoriteEntity } from '~/domains/favorite/infra/persistence/entities/document-favorite.entity';
import { PublishedDocumentEntity } from '~/domains/publish/infra/persistence/entities/published-document.entity';
import { WorkspaceRole } from '~/domains/workspace/domain/enums/workspace-role.enum';
import { WorkspaceMemberEntity } from '~/domains/workspace/infra/persistence/entities/workspace-member.entity';
import { DocumentAccessResolver } from '../app/policies/document-access.resolver';
import { DocumentAccessGrantPermission } from '../domain/enums/document-access-grant-permission.enum';
import { MikroOrmDocumentDetailQueryRepository } from './mikro-orm-document-detail-query.repository';
import { DocumentAccessSettingEntity } from './persistence/entities/document-access-setting.entity';
import { DocumentEntity } from './persistence/entities/document.entity';

type MockScopedEntityManager = {
  count: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
  getConnection: jest.Mock;
};

describe('MikroOrmDocumentDetailQueryRepository', () => {
  const currentUser: AuthenticatedUser = {
    userId: 'user-1',
    email: 'user@example.com',
    status: UserStatus.ACTIVE,
    sessionId: 'session-1',
    roles: [],
    permissions: [],
  };

  it('returns document detail through an inherited parent grant using one fork', async () => {
    const { entityManager, scopedEntityManager } = createEntityManager();
    const repository = new MikroOrmDocumentDetailQueryRepository(
      entityManager,
      new DocumentAccessResolver(),
    );
    const document = createDocument({
      id: 'child-document',
      ownerUser: { id: 'another-user' } as DocumentEntity['ownerUser'],
      parentDocument: { id: 'parent-document' } as DocumentEntity,
    });
    const parentGrant = {
      document: { id: 'parent-document' },
      permission: DocumentAccessGrantPermission.VIEW,
    };

    scopedEntityManager.findOne.mockImplementation((entity: unknown) => {
      if (entity === DocumentEntity) {
        return Promise.resolve(document);
      }

      if (entity === WorkspaceMemberEntity) {
        return Promise.resolve({
          role: WorkspaceRole.MEMBER,
          workspace: document.workspace,
          user: { id: currentUser.userId },
        });
      }

      if (entity === DocumentAccessSettingEntity) {
        return Promise.resolve(null);
      }

      if (entity === DocumentFavoriteEntity) {
        return Promise.resolve(null);
      }

      if (entity === PublishedDocumentEntity) {
        return Promise.resolve(null);
      }

      return Promise.resolve(null);
    });
    scopedEntityManager.find.mockResolvedValue([parentGrant]);
    scopedEntityManager.count.mockResolvedValue(1);
    scopedEntityManager.getConnection.mockReturnValue({
      execute: jest.fn().mockResolvedValue([
        {
          depth: 0,
          id: 'parent-document',
          publicId: 'parent-public-id',
          title: 'Parent document',
        },
      ]),
    });

    const result = await repository.findDocumentDetail({
      documentId: 'child-document',
      currentUser,
    });

    expect(entityManager.fork).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      id: 'child-document',
      parentDocumentId: 'parent-document',
      breadcrumb: [
        {
          id: 'parent-document',
          publicId: 'parent-public-id',
          title: 'Parent document',
        },
      ],
      access: {
        scope: 'shared',
        permission: 'view',
        canView: true,
        canEdit: false,
        canManage: false,
      },
      collaboration: {
        enabled: true,
        mode: 'view',
        showPresence: true,
      },
    });
  });

  it('returns null for a private document owned by another user', async () => {
    const { entityManager, scopedEntityManager } = createEntityManager();
    const repository = new MikroOrmDocumentDetailQueryRepository(
      entityManager,
      new DocumentAccessResolver(),
    );
    const document = createDocument({
      id: 'private-document',
      ownerUser: { id: 'another-user' } as DocumentEntity['ownerUser'],
    });

    scopedEntityManager.findOne.mockImplementation((entity: unknown) => {
      if (entity === DocumentEntity) {
        return Promise.resolve(document);
      }

      return Promise.resolve(null);
    });
    scopedEntityManager.find.mockResolvedValue([]);
    scopedEntityManager.count.mockResolvedValue(0);
    scopedEntityManager.getConnection.mockReturnValue({
      execute: jest.fn().mockResolvedValue([]),
    });

    await expect(repository.findDocumentDetail({
      documentId: 'private-document',
      currentUser,
    })).resolves.toBeNull();
  });
});

function createEntityManager(): {
  entityManager: EntityManager;
  scopedEntityManager: MockScopedEntityManager;
} {
  const scopedEntityManager: MockScopedEntityManager = {
    count: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    getConnection: jest.fn(),
  };
  const entityManager = {
    fork: jest.fn().mockReturnValue(scopedEntityManager),
  } as unknown as EntityManager;

  return {
    entityManager,
    scopedEntityManager,
  };
}

function createDocument(overrides: Partial<DocumentEntity> = {}): DocumentEntity {
  return {
    id: 'document-1',
    publicId: 'public-document-1',
    version: 1,
    workspace: { id: 'workspace-1' },
    teamspace: undefined,
    parentDocument: undefined,
    title: 'Document 1',
    contentFormat: 'blocknote_v1',
    contentJson: [],
    sortKey: 1,
    archivedAt: undefined,
    createdBy: { id: 'user-1' },
    ownerUser: { id: 'user-1' },
    updatedBy: {
      displayName: 'Editor',
      email: 'editor@example.com',
    },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  } as DocumentEntity;
}
