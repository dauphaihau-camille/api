import { Injectable, Logger } from '@nestjs/common';
import { MailSender } from '~/integrations/mail/app/ports/mail-sender';
import { appJobName, type AppJobHandler, type AppJobPayloadMap } from '~/integrations/queue/app/app-job.types';

type SendNotificationEmailPayload =
  AppJobPayloadMap['notification.send-email'];

@Injectable()
export class SendNotificationEmailJob
implements AppJobHandler<typeof appJobName.notificationSendEmail> {
  readonly jobName = appJobName.notificationSendEmail;
  private readonly logger = new Logger(SendNotificationEmailJob.name);

  constructor(private readonly mailSender: MailSender) {}

  async run(payload: SendNotificationEmailPayload): Promise<void> {
    await this.mailSender.send({
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      from: payload.from,
      replyTo: payload.replyTo,
      cc: payload.cc,
      bcc: payload.bcc,
      tags: payload.tags,
    });

    this.logger.log(`Processed notification email job for subject ${payload.subject}`);
  }
}
