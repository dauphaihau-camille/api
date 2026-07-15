import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { AuditService } from '~/integrations/audit/audit.service';
import { WorkspaceRole } from '../../domain/enums/workspace-role.enum';
import type { WorkspaceSummary } from '../contracts/workspace.contract';
import { WorkspaceDefaultDocumentProvisioner } from '../ports/workspace-default-document-provisioner';
import { WorkspaceRepository } from '../ports/workspace.repository';

@Injectable()
export class WorkspaceProvisioningService {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly auditService: AuditService,
    private readonly workspaceDefaultDocumentProvisioner: WorkspaceDefaultDocumentProvisioner,
  ) {}

  async createWorkspaceWithDefaults(
    currentUser: AuthenticatedUser,
    input: {
      name: string;
      slug: string;
      description?: string;
    },
  ): Promise<WorkspaceSummary> {
    const { workspace } = await this.workspaceRepository.createWorkspace({
      ownerUserId: currentUser.userId,
      name: input.name,
      slug: input.slug,
      description: input.description,
    });

    await this.workspaceDefaultDocumentProvisioner.provisionDefaultDocument({
      workspaceId: workspace.id,
      ownerUserId: currentUser.userId,
    });

    await this.auditService.record({
      action: 'workspace.created',
      resourceType: 'workspace',
      resourceId: workspace.id,
      metadata: {
        slug: workspace.slug,
      },
    });
    return {
      id: workspace.id,
      version: workspace.version,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      currentUserRole: WorkspaceRole.OWNER,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
  }
}
