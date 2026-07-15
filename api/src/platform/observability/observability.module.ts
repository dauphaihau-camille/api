import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RequestContextModule } from '../request-context/request-context.module';
import { InternalSentryController } from './internal-sentry.controller';
import { MetricsController } from './metrics.controller';
import { ObservabilityService } from './observability.service';

@Module({
  imports: [ConfigModule, RequestContextModule],
  controllers: [MetricsController, InternalSentryController],
  providers: [ObservabilityService],
  exports: [ObservabilityService],
})
export class ObservabilityModule {}
