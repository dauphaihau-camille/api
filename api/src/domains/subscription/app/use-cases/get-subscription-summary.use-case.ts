import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { WorkspaceRepository } from '~/domains/workspace/app/ports/workspace.repository';
import { findWorkspaceByIdentifier } from '~/domains/workspace/app/utils/find-workspace-by-identifier.util';
import { SubscriptionWorkspaceNotFoundError } from '../errors/subscription-app.error';
import type { SubscriptionSummary } from '../contracts/subscription.contract';
import { SubscriptionSummaryService } from '../services/subscription-summary.service';

@Injectable()
export class GetSubscriptionSummaryUseCase {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly subscriptionSummaryService: SubscriptionSummaryService,
  ) {}

  async execute(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
  ): Promise<SubscriptionSummary> {
    const workspaces = await this.workspaceRepository.findAllForUser(currentUser.userId);
    const workspace = findWorkspaceByIdentifier(workspaces, workspaceIdentifier);

    if (!workspace) {
      throw new SubscriptionWorkspaceNotFoundError(workspaceIdentifier);
    }

    return this.subscriptionSummaryService.getSummary(workspace.id);
  }
}
