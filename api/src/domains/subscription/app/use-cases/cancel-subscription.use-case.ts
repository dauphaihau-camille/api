import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { WorkspaceRepository } from '~/domains/workspace/app/ports/workspace.repository';
import { findWorkspaceByIdentifier } from '~/domains/workspace/app/utils/find-workspace-by-identifier.util';
import { WorkspaceRole } from '~/domains/workspace/domain/enums/workspace-role.enum';
import { SubscriptionPlan } from '../../domain/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../../domain/enums/subscription-status.enum';
import type { SubscriptionSummary } from '../contracts/subscription.contract';
import {
  SubscriptionPermissionDeniedError,
  SubscriptionWorkspaceNotFoundError,
} from '../errors/subscription-app.error';
import { BillingProvider } from '../ports/billing-provider';
import { SubscriptionRepository } from '../ports/subscription.repository';
import { SubscriptionSummaryService } from '../services/subscription-summary.service';

@Injectable()
export class CancelSubscriptionUseCase {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly billingProvider: BillingProvider,
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

    if (workspace.currentUserRole !== WorkspaceRole.OWNER) {
      throw new SubscriptionPermissionDeniedError();
    }

    const subscription = await this.subscriptionRepository.getOrCreateFreeSubscription({
      workspaceId: workspace.id,
      seatCount: await this.subscriptionRepository.countBillableMembers(workspace.id),
    });

    if (subscription.plan === SubscriptionPlan.FREE) {
      return this.subscriptionSummaryService.getSummary(workspace.id);
    }

    if (subscription.providerSubscriptionId) {
      await this.billingProvider.scheduleCancellation({
        providerSubscriptionId: subscription.providerSubscriptionId,
      });
    }

    await this.subscriptionRepository.updateSubscription({
      workspaceId: workspace.id,
      status: SubscriptionStatus.CANCELING,
      cancelAtPeriodEnd: true,
    });

    return this.subscriptionSummaryService.getSummary(workspace.id);
  }
}
