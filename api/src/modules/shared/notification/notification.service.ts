import { Inject, Injectable } from '@nestjs/common';
import { appJobName } from '../../../common/jobs/job.types';
import { JobDispatcher } from '../queue/app/ports/job-dispatcher';
import type { NotificationInput } from './app/notification.types';
import type { NotificationChannel } from './app/ports/notification-channel';
import { NOTIFICATION_CHANNELS } from './infra/notification.constants';

@Injectable()
export class NotificationService {
  constructor(
    private readonly jobDispatcher: JobDispatcher,
    @Inject(NOTIFICATION_CHANNELS)
    private readonly channels: NotificationChannel[],
  ) {}

  async send(input: NotificationInput): Promise<void> {
    if (input.delivery === 'async' && input.channel === 'email') {
      await this.jobDispatcher.dispatch(
        appJobName.notificationSendEmail,
        {
          to: Array.isArray(input.to) ? input.to : [input.to],
          subject: input.subject,
          text: input.text,
          html: input.html,
          from: input.from,
          replyTo: input.replyTo,
          cc: input.cc,
          bcc: input.bcc,
          tags: input.tags,
        },
        {
          deduplicationKey: input.deduplicationKey,
        },
      );

      return;
    }

    const channel = this.channels.find((candidate) => candidate.channel === input.channel);

    if (!channel) {
      throw new Error(`Missing notification channel implementation for ${input.channel}`);
    }

    await channel.send(input);
  }
}
