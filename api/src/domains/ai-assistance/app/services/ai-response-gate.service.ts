import { Injectable } from '@nestjs/common';
import { parseDurationToMilliseconds } from '~/shared/libs/duration';
import { SubscriptionSummaryService } from '~/domains/subscription/app/services/subscription-summary.service';
import { SubscriptionPlan } from '~/domains/subscription/domain/enums/subscription-plan.enum';
import type {
  AiResponseEntitlementSummary,
  AiResponseUsage,
} from '../contracts/ai-assistance.contract';
import { AiResponseEntitlementDeniedError } from '../errors/ai-assistance-app.error';
import { AiConversationRepository } from '../ports/ai-conversation.repository';

const BASE_TRIAL_RESPONSES = 10;
const TRIAL_RESPONSES_PER_SEAT = 5;
const RESERVATION_TTL_MS = parseDurationToMilliseconds('10m', 10 * 60 * 1000);

export type AiResponseReservation = {
  id: string;
  workspaceId: string;
};

@Injectable()
export class AiResponseGateService {
  constructor(
    private readonly subscriptionSummaryService: SubscriptionSummaryService,
    private readonly aiConversationRepository: AiConversationRepository,
  ) {}

  async getEntitlementSummary(workspaceId: string): Promise<AiResponseEntitlementSummary> {
    const subscription = await this.subscriptionSummaryService.getSummary(workspaceId);

    if (subscription.plan === SubscriptionPlan.BUSINESS) {
      return {
        workspaceId,
        plan: subscription.plan,
        allowance: null,
        usedResponses: 0,
        reservedResponses: 0,
        remainingResponses: null,
        limitReached: false,
        upgradeAvailable: false,
      };
    }

    const allowance = resolveTrialResponseAllowance(subscription.seatCount);
    const usage = await this.aiConversationRepository.getTrialResponseUsage({
      workspaceId,
      now: new Date(),
    });

    return buildEntitlementSummary({
      workspaceId,
      plan: subscription.plan,
      allowance,
      usage,
    });
  }

  async reserveResponse(workspaceId: string): Promise<AiResponseReservation | null> {
    const subscription = await this.subscriptionSummaryService.getSummary(workspaceId);

    if (subscription.plan === SubscriptionPlan.BUSINESS) {
      return null;
    }

    const now = new Date();
    const allowance = resolveTrialResponseAllowance(subscription.seatCount);

    const reservation = await this.aiConversationRepository.reserveTrialResponse({
      workspaceId,
      allowance,
      now,
      expiresAt: new Date(now.getTime() + RESERVATION_TTL_MS),
    });

    if (!reservation) {
      throw new AiResponseEntitlementDeniedError(0, false);
    }

    return {
      id: reservation.id,
      workspaceId: reservation.workspaceId,
    };
  }

  async consumeReservation(reservation: AiResponseReservation | null): Promise<void> {
    if (!reservation) {
      return;
    }
    await this.aiConversationRepository.consumeReservation(reservation.id);
  }

  async releaseReservation(reservation: AiResponseReservation | null): Promise<void> {
    if (!reservation) {
      return;
    }
    await this.aiConversationRepository.releaseReservation(reservation.id);
  }
}

// ---------- Private helpers ----------

function resolveTrialResponseAllowance(seatCount: number): number {
  return BASE_TRIAL_RESPONSES + (TRIAL_RESPONSES_PER_SEAT * seatCount);
}

function buildEntitlementSummary(input: {
  workspaceId: string;
  plan: string;
  allowance: number;
  usage: AiResponseUsage;
}): AiResponseEntitlementSummary {
  const usedAndReserved = input.usage.usedResponses + input.usage.reservedResponses;
  const remainingResponses = Math.max(input.allowance - usedAndReserved, 0);

  return {
    workspaceId: input.workspaceId,
    plan: input.plan,
    allowance: input.allowance,
    usedResponses: input.usage.usedResponses,
    reservedResponses: input.usage.reservedResponses,
    remainingResponses,
    limitReached: remainingResponses === 0,
    upgradeAvailable: false,
  };
}
