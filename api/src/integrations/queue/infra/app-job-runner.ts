import { Injectable, Logger } from '@nestjs/common';
import {
  AppJobName,
  type AppJobHandler,
  AppJobPayloadMap,
} from '../app/app-job.types';
import { PermanentlyDeleteArchivedDocumentJob } from '~/domains/document/jobs/permanently-delete-archived-document.job';
import { SendWelcomeEmailJob } from '~/domains/user/jobs/send-welcome-email.job';
import { SendNotificationEmailJob } from '~/integrations/notification/jobs/send-notification-email.job';

@Injectable()
export class AppJobRunner {
  private readonly logger = new Logger(AppJobRunner.name);
  private readonly handlersByName: Map<AppJobName, AppJobHandler>;

  constructor(
    private readonly sendWelcomeEmailJob: SendWelcomeEmailJob,
    private readonly sendNotificationEmailJob: SendNotificationEmailJob,
    private readonly permanentlyDeleteArchivedDocumentJob: PermanentlyDeleteArchivedDocumentJob,
  ) {
    this.handlersByName = new Map<AppJobName, AppJobHandler>([
      this.sendWelcomeEmailJob,
      this.sendNotificationEmailJob,
      this.permanentlyDeleteArchivedDocumentJob,
    ].map((handler) => [handler.jobName, handler]));
  }

  async run<TName extends AppJobName>(
    name: TName,
    payload: AppJobPayloadMap[TName],
  ): Promise<void> {
    this.logger.log(`Running job ${name}`);
    const handler = this.handlersByName.get(name);

    if (!handler) {
      throw new Error(`Unsupported job name: ${String(name)}`);
    }

    await handler.run(payload as never);
  }
}
