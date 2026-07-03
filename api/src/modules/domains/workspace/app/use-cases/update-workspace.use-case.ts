import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { assertWorkspaceEditor } from '../workspace-permissions';
import type { WorkspaceSummary } from '../contracts/workspace.contract';
import type { UpdateWorkspaceInput } from '../contracts/workspace.input';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';
import {
  WorkspaceRepository,
  WorkspaceVersionConflictError,
} from '../ports/workspace.repository';
import { normalizeWorkspaceDescription } from '../utils/workspace-description.util';
import { normalizeWorkspaceName } from '../utils/workspace-name.util';
import {
  isReservedWorkspaceSlug,
  isValidWorkspaceSlug,
  normalizeWorkspaceSlug,
} from '../utils/workspace-slug.util';

@Injectable()
export class UpdateWorkspaceUseCase {
  constructor(private readonly workspaceRepository: WorkspaceRepository) {}

  async execute(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
    input: UpdateWorkspaceInput,
  ): Promise<WorkspaceSummary> {
    const access = await resolveWorkspaceForUser(this.workspaceRepository, workspaceIdentifier, currentUser);

    assertWorkspaceEditor(access.currentUserRole);

    const nextName = input.name !== undefined
      ? normalizeWorkspaceName(input.name)
      : undefined;
    const nextSlug = await this.resolveUpdateSlug(access, input, nextName);

    try {
      const updatedWorkspace = await this.workspaceRepository.updateWorkspace({
        workspaceId: access.id,
        version: input.version,
        ...(nextName ? { name: nextName } : {}),
        ...(nextSlug ? { slug: nextSlug } : {}),
        ...(input.description !== undefined
          ? { description: normalizeWorkspaceDescription(input.description) }
          : {}),
      });

      if (!updatedWorkspace) {
        throw new NotFoundException(`Workspace ${workspaceIdentifier} was not found.`);
      }

      return {
        ...updatedWorkspace,
        currentUserRole: access.currentUserRole,
      };
    }
    catch (error) {
      if (error instanceof WorkspaceVersionConflictError) {
        throw new ConflictException('Workspace version conflict.');
      }

      throw error;
    }
  }

  private async resolveUpdateSlug(
    workspace: WorkspaceSummary,
    input: UpdateWorkspaceInput,
    nextName?: string,
  ): Promise<string | undefined> {
    if (input.slug !== undefined) {
      const requestedSlug = normalizeWorkspaceSlug(input.slug);

      if (requestedSlug === workspace.slug) {
        return undefined;
      }

      return this.validateRequestedSlug(requestedSlug, workspace.id);
    }

    if (nextName && nextName !== workspace.name) {
      return undefined;
    }

    return undefined;
  }

  private async validateRequestedSlug(
    slug: string,
    workspaceIdToIgnore?: string,
  ): Promise<string> {
    const normalizedSlug = normalizeWorkspaceSlug(slug);

    if (normalizedSlug.length < 3 || normalizedSlug.length > 32) {
      throw new BadRequestException('Workspace domain must be 3 to 32 characters.');
    }

    if (!isValidWorkspaceSlug(normalizedSlug)) {
      throw new BadRequestException('Workspace domain is invalid.');
    }

    if (isReservedWorkspaceSlug(normalizedSlug)) {
      throw new ConflictException('Workspace domain is reserved.');
    }

    const existingWorkspace = await this.workspaceRepository.findBySlug(normalizedSlug);

    if (existingWorkspace && existingWorkspace.id !== workspaceIdToIgnore) {
      throw new ConflictException('Workspace domain is already in use.');
    }

    return normalizedSlug;
  }
}
