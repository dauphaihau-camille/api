import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/app/auth.types';
import type { WorkspaceSummary } from './workspace.types';

@Injectable()
export class WorkspaceService {
  listForUser(currentUser: AuthenticatedUser): WorkspaceSummary[] {
    return [this.buildPersonalWorkspace(currentUser)];
  }

  getForUser(workspaceId: string, currentUser: AuthenticatedUser): WorkspaceSummary {
    const workspace = this.listForUser(currentUser).find((item) => item.id === workspaceId);

    if (!workspace) {
      throw new NotFoundException(`Workspace ${workspaceId} was not found.`);
    }

    return workspace;
  }

  private buildPersonalWorkspace(currentUser: AuthenticatedUser): WorkspaceSummary {
    const baseName = currentUser.displayName?.trim()
      || currentUser.email.split('@')[0]
      || 'Camille';

    return {
      id: `personal-${currentUser.userId}`,
      name: `${baseName}'s Workspace`,
      slug: this.slugify(baseName),
    };
  }

  private slugify(value: string): string {
    const normalized = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return normalized || 'workspace';
  }
}
