import { Injectable, Logger } from '@nestjs/common';
import {
  appJobName,
  AppJobName,
  AppJobPayloadMap,
} from '../app/app-job.types';
import { PermanentlyDeleteArchivedDocumentJob } from '~/domains/document/jobs/permanently-delete-archived-document.job';
import { SendWelcomeEmailJob } from '~/domains/user/jobs/send-welcome-email.job';
import { SendNotificationEmailJob } from '~/integrations/notification/jobs/send-notification-email.job';

@Injectable()
export class AppJobRunner {
  private readonly logger = new Logger(AppJobRunner.name);

  constructor(
    private readonly sendWelcomeEmailJob: SendWelcomeEmailJob,
    private readonly sendNotificationEmailJob: SendNotificationEmailJob,
    private readonly permanentlyDeleteArchivedDocumentJob: PermanentlyDeleteArchivedDocumentJob,
  ) {}

  async run<TName extends AppJobName>(
    name: TName,
    payload: AppJobPayloadMap[TName],
  ): Promise<void> {
    this.logger.log(`Running job ${name}`);

    switch (name) {
      case appJobName.sendWelcomeEmail:
        await this.sendWelcomeEmailJob.run(
          payload as AppJobPayloadMap[typeof appJobName.sendWelcomeEmail],
        );
        return;
      case appJobName.notificationSendEmail:
        await this.sendNotificationEmailJob.run(
          payload as AppJobPayloadMap[typeof appJobName.notificationSendEmail],
        );
        return;
      case appJobName.permanentlyDeleteArchivedDocument:
        await this.permanentlyDeleteArchivedDocumentJob.run(
          payload as AppJobPayloadMap[typeof appJobName.permanentlyDeleteArchivedDocument],
        );
        return;
    }

    throw new Error(`Unsupported job name: ${String(name)}`);
  }
}
