import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import type { WorkspaceSummary } from '../contracts/workspace.contract';
import type { CreateWorkspaceInput } from '../contracts/workspace.input';
import { WorkspaceRepository } from '../ports/workspace.repository';
import { WorkspaceProvisioningService } from '../services/workspace-provisioning.service';
import { normalizeWorkspaceDescription } from '../utils/workspace-description.util';
import { normalizeWorkspaceName } from '../utils/workspace-name.util';
import {
  isReservedWorkspaceSlug,
  isValidWorkspaceSlug,
  normalizeWorkspaceSlug,
  slugifyWorkspaceName,
} from '../utils/workspace-slug.util';

@Injectable()
export class CreateWorkspaceUseCase {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly workspaceProvisioningService: WorkspaceProvisioningService,
  ) {}

  async execute(
    currentUser: AuthenticatedUser,
    input: CreateWorkspaceInput,
  ): Promise<WorkspaceSummary> {
    const normalizedName = normalizeWorkspaceName(input.name);
    const slug = await this.resolveCreateSlug(normalizedName, input.slug);

    return this.workspaceProvisioningService.createWorkspaceWithDefaults(currentUser, {
      name: normalizedName,
      slug,
      description: normalizeWorkspaceDescription(input.description),
    });
  }

  private async resolveCreateSlug(name: string, requestedSlug?: string): Promise<string> {
    if (!requestedSlug) {
      return this.buildUniqueSlug(slugifyWorkspaceName(name));
    }

    return this.validateRequestedSlug(requestedSlug);
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
}
