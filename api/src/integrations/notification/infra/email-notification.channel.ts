import { Injectable } from '@nestjs/common';
import type { NotificationInput } from '../app/notification.types';
import { NotificationChannel } from '../app/ports/notification-channel';
import { MailSender } from '../../mail/app/ports/mail-sender';

@Injectable()
export class EmailNotificationChannel implements NotificationChannel {
  readonly channel = 'email' as const;

  constructor(private readonly mailSender: MailSender) {}

  async send(input: NotificationInput): Promise<void> {
    if (input.channel !== 'email') {
      throw new Error(`Unsupported notification channel: ${input.channel}`);
    }

    await this.mailSender.send({
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      from: input.from,
      replyTo: input.replyTo,
      cc: input.cc,
      bcc: input.bcc,
      tags: input.tags,
    });
  }
}
