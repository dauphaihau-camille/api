import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { QueueModule } from '../queue/queue.module';
import { NotificationService } from './notification.service';
import { NotificationChannel } from './app/ports/notification-channel';
import { EmailNotificationChannel } from './infra/email-notification.channel';
import { NOTIFICATION_CHANNELS } from './infra/notification.constants';

@Module({
  imports: [MailModule, QueueModule],
  providers: [
    EmailNotificationChannel,
    {
      provide: NOTIFICATION_CHANNELS,
      inject: [EmailNotificationChannel],
      useFactory: (emailNotificationChannel: EmailNotificationChannel): NotificationChannel[] => [
        emailNotificationChannel,
      ],
    },
    NotificationService,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
