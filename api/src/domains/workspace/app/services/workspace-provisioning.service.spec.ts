import type { EntityManager } from '@mikro-orm/postgresql';
import type { CurrentUserEntity } from '~/domains/auth/infra/persistence/entities/current-user.entity';
import type { AuditService } from '~/integrations/audit/audit.service';
import { WorkspaceRole } from '../../domain/enums/workspace-role.enum';
import type { WorkspaceMemberEntity } from '../../infra/persistence/entities/workspace-member.entity';
import type { WorkspaceEntity } from '../../infra/persistence/entities/workspace.entity';
import type { WorkspaceDefaultDocumentProvisioner } from '../ports/workspace-default-document-provisioner';
import { WorkspaceProvisioningService } from './workspace-provisioning.service';
import { UserStatus } from '~/domains/auth/domain/enums/user-status.enum';

describe('WorkspaceProvisioningService', () => {
  it('delegates default document creation to the document provisioner', async () => {
    const owner = { id: 'user-1' } as CurrentUserEntity;
    const workspace = {
      id: 'workspace-1',
      version: 1,
      name: 'Acme',
      slug: 'acme',
      description: 'Primary workspace',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    } as WorkspaceEntity;
    const membership = { id: 'membership-1' } as WorkspaceMemberEntity;

    const transactionalEntityManager = {
      findOneOrFail: jest.fn().mockResolvedValue(owner),
      create: jest
        .fn()
        .mockReturnValueOnce(workspace)
        .mockReturnValueOnce(membership),
      persist: jest.fn().mockReturnValue({
        flush: jest.fn().mockResolvedValue(undefined),
      }),
    } as unknown as jest.Mocked<EntityManager>;

    const entityManager = {
      transactional: jest
        .fn()
        .mockImplementation(async (
          callback: (transactionalEntityManager: EntityManager) => Promise<unknown>,
        ) => callback(transactionalEntityManager)),
    } as unknown as jest.Mocked<EntityManager>;

    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditService>;

    const workspaceDefaultDocumentProvisioner = {
      provisionDefaultDocument: jest.fn().mockResolvedValue({ documentId: 'document-1' }),
    } as unknown as jest.Mocked<WorkspaceDefaultDocumentProvisioner>;

    const service = new WorkspaceProvisioningService(
      entityManager,
      auditService,
      workspaceDefaultDocumentProvisioner,
    );

    const result = await service.createWorkspaceWithDefaults(
      {
        userId: owner.id,
        email: 'owner@example.com',
        permissions: [],
        status: UserStatus.ACTIVE,
        sessionId: '',
        roles: [],
      },
      {
        name: workspace.name,
        slug: workspace.slug,
        description: workspace.description,
      },
    );

    expect(workspaceDefaultDocumentProvisioner.provisionDefaultDocument).toHaveBeenCalledWith({
      entityManager: transactionalEntityManager,
      workspaceId: workspace.id,
      ownerUserId: owner.id,
    });
    expect(auditService.record).toHaveBeenCalledWith({
      action: 'workspace.created',
      resourceType: 'workspace',
      resourceId: workspace.id,
      metadata: {
        slug: workspace.slug,
      },
    });
    expect(result).toEqual({
      id: workspace.id,
      version: workspace.version,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      currentUserRole: WorkspaceRole.OWNER,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    });
  });
});
