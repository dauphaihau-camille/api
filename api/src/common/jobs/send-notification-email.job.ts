import { Injectable, Logger } from '@nestjs/common';
import { MailSender } from '../../modules/shared/mail/app/ports/mail-sender';
import type { AppJobPayloadMap } from './job.types';

type SendNotificationEmailPayload =
  AppJobPayloadMap['notification.send-email'];

@Injectable()
export class SendNotificationEmailJob {
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
