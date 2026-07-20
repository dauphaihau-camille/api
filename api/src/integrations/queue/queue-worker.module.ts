import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { LoggerModule } from 'nestjs-pino';
import { validateAppEnv } from '~/platform/config/app-env.config';
import { buildDatabaseConfig } from '~/platform/config/database.config';
import { buildPinoLoggerParams } from '~/platform/logging/pino-logger.config';
import { AppJobRunnerModule } from '~/bootstrap/app-job-runner.module';
import { QueueModule } from './queue.module';
import { BullMqWorkerService } from './infra/bullmq-worker.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateAppEnv,
    }),
    MikroOrmModule.forRoot({
      ...buildDatabaseConfig(process.env),
      autoLoadEntities: true,
      registerRequestContext: false,
    }),
    LoggerModule.forRoot(buildPinoLoggerParams('worker')),
    AppJobRunnerModule,
    QueueModule,
  ],
  providers: [BullMqWorkerService],
})
export class QueueWorkerModule {}
