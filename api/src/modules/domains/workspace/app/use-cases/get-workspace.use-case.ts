import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import type { WorkspaceSummary } from '../contracts/workspace.contract';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';
import { WorkspaceRepository } from '../ports/workspace.repository';

@Injectable()
export class GetWorkspaceUseCase {
  constructor(private readonly workspaceRepository: WorkspaceRepository) {}

  execute(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
  ): Promise<WorkspaceSummary> {
    return resolveWorkspaceForUser(this.workspaceRepository, workspaceIdentifier, currentUser);
  }
}
