import { Injectable } from '@nestjs/common';
import { SubscriptionPlan } from '../../domain/enums/subscription-plan.enum';
import type { SubscriptionEntitlements } from '../contracts/subscription.contract';

const COLLABORATIVE_FREE_BLOCK_LIMIT = 1000;

@Injectable()
export class SubscriptionEntitlementService {
  resolveEntitlements(input: {
    plan: SubscriptionPlan;
    seatCount: number;
  }): SubscriptionEntitlements {
    if (
      input.plan === SubscriptionPlan.PLUS
      || input.plan === SubscriptionPlan.BUSINESS
    ) {
      return { maxBlocks: null };
    }

    if (input.seatCount <= 1) {
      return { maxBlocks: null };
    }

    return { maxBlocks: COLLABORATIVE_FREE_BLOCK_LIMIT };
  }
}
