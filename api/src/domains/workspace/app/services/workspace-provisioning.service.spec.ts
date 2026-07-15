import type { AuditService } from '~/integrations/audit/audit.service';
import { WorkspaceRole } from '../../domain/enums/workspace-role.enum';
import type { WorkspaceDefaultDocumentProvisioner } from '../ports/workspace-default-document-provisioner';
import type { WorkspaceRepository } from '../ports/workspace.repository';
import { WorkspaceProvisioningService } from './workspace-provisioning.service';
import { UserStatus } from '~/domains/auth/domain/enums/user-status.enum';

describe('WorkspaceProvisioningService', () => {
  it('delegates default document creation to the document provisioner', async () => {
    const workspace = {
      id: 'workspace-1',
      version: 1,
      name: 'Acme',
      slug: 'acme',
      description: 'Primary workspace',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      currentUserRole: WorkspaceRole.OWNER,
    };

    const workspaceRepository = {
      createWorkspace: jest.fn().mockResolvedValue({
        workspace,
        membership: { id: 'membership-1' },
      }),
    } as unknown as jest.Mocked<WorkspaceRepository>;

    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditService>;

    const workspaceDefaultDocumentProvisioner = {
      provisionDefaultDocument: jest.fn().mockResolvedValue({ documentId: 'document-1' }),
    } as unknown as jest.Mocked<WorkspaceDefaultDocumentProvisioner>;

    const service = new WorkspaceProvisioningService(
      workspaceRepository,
      auditService,
      workspaceDefaultDocumentProvisioner,
    );

    const result = await service.createWorkspaceWithDefaults(
      {
        userId: 'user-1',
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

    expect(workspaceRepository.createWorkspace).toHaveBeenCalledWith({
      ownerUserId: 'user-1',
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
    });
    expect(workspaceDefaultDocumentProvisioner.provisionDefaultDocument).toHaveBeenCalledWith({
      workspaceId: workspace.id,
      ownerUserId: 'user-1',
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
