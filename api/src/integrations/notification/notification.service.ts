import { Inject, Injectable, Logger } from '@nestjs/common';
import { appJobName } from '~/integrations/queue/app/app-job.types';
import { JobDispatcher } from '../queue/app/ports/job-dispatcher';
import type { NotificationInput } from './app/notification.types';
import type { NotificationChannel } from './app/ports/notification-channel';
import { NOTIFICATION_CHANNELS } from './infra/notification.constants';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly jobDispatcher: JobDispatcher,
    @Inject(NOTIFICATION_CHANNELS)
    private readonly channels: NotificationChannel[],
  ) {}

  async send(input: NotificationInput): Promise<void> {
    if (input.delivery === 'async' && input.channel === 'email') {
      try {
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
      }
      catch (error) {
        this.logger.warn(
          `Async notification enqueue failed, continuing: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }

      return;
    }

    const channel = this.channels.find((candidate) => candidate.channel === input.channel);

    if (!channel) {
      throw new Error(`Missing notification channel implementation for ${input.channel}`);
    }

    await channel.send(input);
  }
}
