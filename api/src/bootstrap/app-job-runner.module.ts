import { Global, Module } from '@nestjs/common';
import { DocumentJobModule } from '~/domains/document/document-job.module';
import { UserJobModule } from '~/domains/user/user-job.module';
import { NotificationJobModule } from '~/integrations/notification/notification-job.module';
import { AppJobRunner, appJobRunnerProvider } from './app-job-runner';

@Global()
@Module({
  imports: [DocumentJobModule, UserJobModule, NotificationJobModule],
  providers: [AppJobRunner, appJobRunnerProvider],
  exports: [AppJobRunner, appJobRunnerProvider],
})
export class AppJobRunnerModule {}
