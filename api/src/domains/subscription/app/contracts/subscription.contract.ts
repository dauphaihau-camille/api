import type { SubscriptionPlan } from '../../domain/enums/subscription-plan.enum';
import type { SubscriptionStatus } from '../../domain/enums/subscription-status.enum';

export type SubscriptionEntitlements = {
  maxBlocks: number | null;
};

export type WorkspaceSubscriptionRecord = {
  id: string;
  version: number;
  workspaceId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  seatCount: number;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
  provider?: string;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  providerPriceId?: string;
  providerStatus?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SubscriptionSummary = {
  workspaceId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  seatCount: number;
  blockCount: number;
  blockLimit: number | null;
  entitlements: SubscriptionEntitlements;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
  providerStatus?: string;
};

export type CheckoutSessionSummary = {
  sessionId: string;
  checkoutUrl: string;
  expiresAt?: Date;
};

export type BillingWebhookResult = {
  eventId: string;
  eventType: string;
  handled: boolean;
};
