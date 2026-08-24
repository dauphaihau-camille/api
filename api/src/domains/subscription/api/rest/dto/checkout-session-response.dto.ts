import { ApiProperty } from '@nestjs/swagger';
import type { CheckoutSessionSummary } from '../../../app/contracts/subscription.contract';

export class CheckoutSessionResponseDto {
  @ApiProperty()
  session_id!: string;

  @ApiProperty()
  checkout_url!: string;

  @ApiProperty({ required: false })
  expires_at?: string;

  static fromSummary(summary: CheckoutSessionSummary): CheckoutSessionResponseDto {
    return {
      session_id: summary.sessionId,
      checkout_url: summary.checkoutUrl,
      expires_at: summary.expiresAt?.toISOString(),
    };
  }
}
