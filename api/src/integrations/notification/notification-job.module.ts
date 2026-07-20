import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { SendNotificationEmailJob } from './jobs/send-notification-email.job';

@Module({
  imports: [MailModule],
  providers: [SendNotificationEmailJob],
  exports: [SendNotificationEmailJob],
})
export class NotificationJobModule {}
