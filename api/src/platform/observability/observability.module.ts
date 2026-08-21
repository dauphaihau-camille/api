import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RequestContextModule } from '../request-context/request-context.module';
import { DatabasePoolObservabilityService } from './database-pool-observability.service';
import { InternalSentryController } from './internal-sentry.controller';
import { MetricsController } from './metrics.controller';
import { ObservabilityService } from './observability.service';

@Module({
  imports: [ConfigModule, MikroOrmModule, RequestContextModule],
  controllers: [MetricsController, InternalSentryController],
  providers: [DatabasePoolObservabilityService, ObservabilityService],
  exports: [ObservabilityService],
})
export class ObservabilityModule {}
