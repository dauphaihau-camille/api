import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { WorkspaceRepository } from '~/domains/workspace/app/ports/workspace.repository';
import { findWorkspaceByIdentifier } from '~/domains/workspace/app/utils/find-workspace-by-identifier.util';
import { WorkspaceRole } from '~/domains/workspace/domain/enums/workspace-role.enum';
import type { CheckoutSessionSummary } from '../contracts/subscription.contract';
import {
  SubscriptionPermissionDeniedError,
  SubscriptionWorkspaceNotFoundError,
} from '../errors/subscription-app.error';
import { BillingProvider } from '../ports/billing-provider';
import { SubscriptionRepository } from '../ports/subscription.repository';

@Injectable()
export class CreateCheckoutSessionUseCase {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly billingProvider: BillingProvider,
  ) {}

  async execute(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
    options: {
      returnUrl?: string;
    } = {},
  ): Promise<CheckoutSessionSummary> {
    const workspaces = await this.workspaceRepository.findAllForUser(currentUser.userId);
    const workspace = findWorkspaceByIdentifier(workspaces, workspaceIdentifier);

    if (!workspace) {
      throw new SubscriptionWorkspaceNotFoundError(workspaceIdentifier);
    }

    if (
      workspace.currentUserRole !== WorkspaceRole.OWNER
      && workspace.currentUserRole !== WorkspaceRole.ADMIN
    ) {
      throw new SubscriptionPermissionDeniedError();
    }

    const seatCount = await this.subscriptionRepository.countBillableMembers(workspace.id);
    await this.subscriptionRepository.getOrCreateFreeSubscription({
      workspaceId: workspace.id,
      seatCount,
    });

    return this.billingProvider.startPlusCheckout({
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      customerEmail: currentUser.email,
      seatCount,
      returnUrl: options.returnUrl,
    });
  }
}
