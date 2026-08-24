import { ApiProperty } from '@nestjs/swagger';
import type { SubscriptionSummary } from '../../../app/contracts/subscription.contract';

export class SubscriptionEntitlementsResponseDto {
  @ApiProperty({ type: Number, nullable: true })
  max_blocks!: number | null;

  static fromSummary(summary: SubscriptionSummary): SubscriptionEntitlementsResponseDto {
    return {
      max_blocks: summary.entitlements.maxBlocks,
    };
  }
}

export class SubscriptionSummaryResponseDto {
  @ApiProperty()
  workspace_id!: string;

  @ApiProperty({ enum: ['free', 'plus'] })
  plan!: string;

  @ApiProperty({ enum: ['free', 'active', 'past_due', 'canceling'] })
  status!: string;

  @ApiProperty()
  seat_count!: number;

  @ApiProperty()
  block_count!: number;

  @ApiProperty({ type: Number, nullable: true })
  block_limit!: number | null;

  @ApiProperty({ type: SubscriptionEntitlementsResponseDto })
  entitlements!: SubscriptionEntitlementsResponseDto;

  @ApiProperty({ required: false })
  current_period_start?: string;

  @ApiProperty({ required: false })
  current_period_end?: string;

  @ApiProperty()
  cancel_at_period_end!: boolean;

  @ApiProperty({ required: false })
  provider_status?: string;

  static fromSummary(summary: SubscriptionSummary): SubscriptionSummaryResponseDto {
    return {
      workspace_id: summary.workspaceId,
      plan: summary.plan,
      status: summary.status,
      seat_count: summary.seatCount,
      block_count: summary.blockCount,
      block_limit: summary.blockLimit,
      entitlements: SubscriptionEntitlementsResponseDto.fromSummary(summary),
      current_period_start: summary.currentPeriodStart?.toISOString(),
      current_period_end: summary.currentPeriodEnd?.toISOString(),
      cancel_at_period_end: summary.cancelAtPeriodEnd,
      provider_status: summary.providerStatus,
    };
  }
}
