import { ApiProperty } from '@nestjs/swagger';
import type { BillingWebhookResult } from '../../../app/contracts/subscription.contract';

export class BillingWebhookResponseDto {
  @ApiProperty()
  event_id!: string;

  @ApiProperty()
  event_type!: string;

  @ApiProperty()
  handled!: boolean;

  static fromResult(result: BillingWebhookResult): BillingWebhookResponseDto {
    return {
      event_id: result.eventId,
      event_type: result.eventType,
      handled: result.handled,
    };
  }
}
