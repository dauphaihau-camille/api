import type { EntityManager } from '@mikro-orm/postgresql';
import { WorkspaceRole } from '../../workspace/domain/enums/workspace-role.enum';
import { WorkspaceMemberEntity } from '../../workspace/infra/persistence/entities/workspace-member.entity';
import { MikroOrmDocumentCollaborationRepository } from './mikro-orm-document-collaboration.repository';
import { DocumentEntity } from './persistence/entities/document.entity';

describe('MikroOrmDocumentCollaborationRepository', () => {
  function createRepository(
    document: Record<string, unknown> | null,
    membership?: Record<string, unknown> | null,
  ) {
    const scopedEntityManager = {
      findOne: jest.fn()
        .mockResolvedValueOnce(document)
        .mockResolvedValueOnce(membership),
    };
    const entityManager = {
      fork: jest.fn().mockReturnValue(scopedEntityManager),
    };

    return {
      repository: new MikroOrmDocumentCollaborationRepository(
        entityManager as unknown as EntityManager,
      ),
      scopedEntityManager,
    };
  }

  it('returns no access when the document does not exist', async () => {
    const { repository, scopedEntityManager } = createRepository(null);

    await expect(repository.getAccess('missing-document', 'user-1'))
      .resolves.toBeNull();

    expect(scopedEntityManager.findOne).toHaveBeenCalledTimes(1);
    expect(scopedEntityManager.findOne).toHaveBeenCalledWith(
      DocumentEntity,
      'missing-document',
      { populate: ['workspace'] },
    );
  });

  it('returns no access when the user is not a workspace member', async () => {
    const document = {
      workspace: { id: 'workspace-1' },
    };
    const { repository, scopedEntityManager } = createRepository(document, null);

    await expect(repository.getAccess('document-1', 'outside-user'))
      .resolves.toBeNull();

    expect(scopedEntityManager.findOne).toHaveBeenNthCalledWith(
      2,
      WorkspaceMemberEntity,
      {
        workspace: 'workspace-1',
        user: 'outside-user',
      },
    );
  });

  it.each([
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
  ])(
    'returns the %s workspace role for capability resolution',
    async (role) => {
      const document = {
        contentJson: [{ type: 'paragraph' }],
        createdBy: { id: 'another-user' },
        teamspace: undefined,
        title: 'Private document',
        workspace: { id: 'workspace-1' },
      };
      const { repository } = createRepository(document, { role });

      await expect(repository.getAccess('document-1', 'user-1')).resolves.toEqual({
        content: document.contentJson,
        title: document.title,
        workspaceId: document.workspace.id,
        workspaceRole: role,
      });
    },
  );
});
