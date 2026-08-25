import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { AuditService } from '~/integrations/audit/audit.service';
import { WorkspaceNotFoundError } from '../errors/workspace-app.error';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';
import { WorkspaceRepository } from '../ports/workspace.repository';
import { assertWorkspaceDeletion } from '../workspace-permissions';

@Injectable()
export class DeleteWorkspaceUseCase {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
  ): Promise<void> {
    const workspace = await resolveWorkspaceForUser(
      this.workspaceRepository,
      workspaceIdentifier,
      currentUser,
    );

    assertWorkspaceDeletion(workspace.currentUserRole);

    const wasDeleted = await this.workspaceRepository.deleteWorkspace(workspace.id);

    if (!wasDeleted) {
      throw new WorkspaceNotFoundError(workspaceIdentifier);
    }

    await this.auditService.record({
      action: 'workspace.deleted',
      resourceType: 'workspace',
      resourceId: workspace.id,
      metadata: {
        slug: workspace.slug,
        name: workspace.name,
      },
    });
  }
}
