import { Logger } from '@nestjs/common';
import type {
  AppJobName,
  AppJobPayloadMap,
  DispatchJobOptions,
} from '../app/app-job.types';
import type { AppJobRunner } from '../app/app-job-runner';
import type { JobDispatcher } from '../app/ports/job-dispatcher';

export class InlineJobDispatcher implements JobDispatcher {
  private readonly logger = new Logger(InlineJobDispatcher.name);

  constructor(private readonly appJobRunner: AppJobRunner) {}

  async dispatch<TName extends AppJobName>(
    name: TName,
    payload: AppJobPayloadMap[TName],
    options?: DispatchJobOptions,
  ): Promise<void> {
    if ((options?.delayMs ?? 0) > 0) {
      this.logger.warn(
        `Skipping inline delayed job ${name}; delayed execution requires the redis queue driver`,
      );
      return;
    }

    this.logger.log(
      `Running inline job ${name}${options?.deduplicationKey ? ` (${options.deduplicationKey})` : ''}`,
    );

    await this.appJobRunner.run(name, payload);
  }
}
