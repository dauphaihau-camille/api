import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/app/auth.types';
import {
  assertWorkspaceEditor,
} from './workspace-permissions';
import {
  isReservedWorkspaceSlug,
  isValidWorkspaceSlug,
  normalizeWorkspaceSlug,
  slugifyWorkspaceName,
} from './workspace-slug';
import {
  WorkspaceRepository,
  WorkspaceVersionConflictError,
} from './workspace.repository';
import { WorkspaceProvisioningService } from './workspace-provisioning.service';
import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  WorkspaceSummary,
} from './workspace.types';

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly workspaceProvisioningService: WorkspaceProvisioningService,
  ) {}

  listForUser(currentUser: AuthenticatedUser): Promise<WorkspaceSummary[]> {
    return this.workspaceRepository.findAllForUser(currentUser.userId);
  }

  async getForUser(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
  ): Promise<WorkspaceSummary> {
    return this.resolveWorkspaceForUser(workspaceIdentifier, currentUser);
  }

  async createForUser(
    currentUser: AuthenticatedUser,
    input: CreateWorkspaceInput,
  ): Promise<WorkspaceSummary> {
    const normalizedName = input.name.trim();

    if (normalizedName.length < 2) {
      throw new BadRequestException('Workspace name must be at least 2 characters.');
    }

    const slug = await this.resolveCreateSlug(normalizedName, input.slug);
    return this.workspaceProvisioningService.createWorkspaceWithDefaults(currentUser, {
      name: normalizedName,
      slug,
      description: this.normalizeDescription(input.description),
    });
  }

  async updateForUser(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
    input: UpdateWorkspaceInput,
  ): Promise<WorkspaceSummary> {
    const access = await this.resolveWorkspaceForUser(workspaceIdentifier, currentUser);

    assertWorkspaceEditor(access.currentUserRole);

    const nextName = input.name?.trim();

    if (input.name !== undefined && (!nextName || nextName.length < 2)) {
      throw new BadRequestException('Workspace name must be at least 2 characters.');
    }
    const nextSlug = await this.resolveUpdateSlug(access, input, nextName);

    try {
      const updatedWorkspace = await this.workspaceRepository.updateWorkspace({
        workspaceId: access.id,
        version: input.version,
        ...(nextName ? { name: nextName } : {}),
        ...(nextSlug ? { slug: nextSlug } : {}),
        ...(input.description !== undefined
          ? { description: this.normalizeDescription(input.description) }
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

  private async resolveCreateSlug(name: string, requestedSlug?: string): Promise<string> {
    if (!requestedSlug) {
      return this.buildUniqueSlug(slugifyWorkspaceName(name));
    }

    return this.validateRequestedSlug(requestedSlug);
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

  private async buildUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let counter = 2;

    while (true) {
      if (!isReservedWorkspaceSlug(slug)) {
        const existingWorkspace = await this.workspaceRepository.findBySlug(slug);

        if (!existingWorkspace) {
          return slug;
        }
      }

      slug = `${baseSlug}-${counter}`;
      counter += 1;
    }
  }

  private async resolveWorkspaceForUser(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
  ): Promise<WorkspaceSummary> {
    const workspaces = await this.workspaceRepository.findAllForUser(currentUser.userId);
    const normalizedIdentifier = workspaceIdentifier.trim().toLowerCase();
    const workspace = workspaces.find((item) =>
      item.id === workspaceIdentifier || item.slug === normalizedIdentifier,
    );

    if (!workspace) {
      throw new NotFoundException(`Workspace ${workspaceIdentifier} was not found.`);
    }

    return workspace;
  }

  private normalizeDescription(value?: string): string | undefined {
    const normalized = value?.trim();

    return normalized ? normalized : undefined;
  }
}
