import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import type { WorkspaceSummary } from '../contracts/workspace.contract';
import { WorkspaceRepository } from '../ports/workspace.repository';

@Injectable()
export class ListUserWorkspacesUseCase {
  constructor(private readonly workspaceRepository: WorkspaceRepository) {}

  execute(currentUser: AuthenticatedUser): Promise<WorkspaceSummary[]> {
    return this.workspaceRepository.findAllForUser(currentUser.userId);
  }
}
