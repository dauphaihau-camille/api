import { Module } from '@nestjs/common';
import { MailModule } from '~/integrations/mail/mail.module';
import { SendWelcomeEmailJob } from './jobs/send-welcome-email.job';

@Module({
  imports: [MailModule],
  providers: [SendWelcomeEmailJob],
  exports: [SendWelcomeEmailJob],
})
export class UserJobModule {}
