import { Injectable } from '@nestjs/common';
import { WorkspaceBlockLimitReachedError } from '../errors/subscription-app.error';
import { SubscriptionSummaryService } from './subscription-summary.service';

@Injectable()
export class BlockCreationGateService {
  constructor(private readonly subscriptionSummaryService: SubscriptionSummaryService) {}

  async assertCanCreateBlocks(input: {
    workspaceId: string;
    newBlockCount: number;
  }): Promise<void> {
    if (input.newBlockCount <= 0) {
      return;
    }

    const summary = await this.subscriptionSummaryService.getSummary(input.workspaceId);

    if (summary.blockLimit === null) {
      return;
    }

    if (summary.blockCount + input.newBlockCount <= summary.blockLimit) {
      return;
    }

    throw new WorkspaceBlockLimitReachedError({
      plan: summary.plan,
      blockCount: summary.blockCount,
      blockLimit: summary.blockLimit,
      upgradeAvailable: true,
    });
  }
}
