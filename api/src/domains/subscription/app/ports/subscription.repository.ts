import type {
  WorkspaceSubscriptionRecord,
} from '../contracts/subscription.contract';
import type { SubscriptionPlan } from '../../domain/enums/subscription-plan.enum';
import type { SubscriptionStatus } from '../../domain/enums/subscription-status.enum';

export abstract class SubscriptionRepository {
  abstract findByWorkspaceId(workspaceId: string): Promise<WorkspaceSubscriptionRecord | null>;

  abstract findByProviderSubscriptionId(
    providerSubscriptionId: string,
  ): Promise<WorkspaceSubscriptionRecord | null>;

  abstract getOrCreateFreeSubscription(input: {
    workspaceId: string;
    seatCount: number;
  }): Promise<WorkspaceSubscriptionRecord>;

  abstract countBillableMembers(workspaceId: string): Promise<number>;

  abstract countWorkspaceBlocks(workspaceId: string): Promise<number>;

  abstract updateSubscription(input: {
    workspaceId: string;
    plan?: SubscriptionPlan;
    status?: SubscriptionStatus;
    seatCount?: number;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    cancelAtPeriodEnd?: boolean;
    provider?: string;
    providerCustomerId?: string;
    providerSubscriptionId?: string;
    providerPriceId?: string;
    providerStatus?: string;
  }): Promise<WorkspaceSubscriptionRecord>;
}
