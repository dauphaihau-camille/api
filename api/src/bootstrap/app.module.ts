import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { LoggerModule } from 'nestjs-pino';
import { buildPinoLoggerParams } from '../platform/logging/pino-logger.config';
import { RequestContextModule } from '../platform/request-context/request-context.module';
import { validateAppEnv } from '../platform/config/app-env.config';
import { buildDatabaseConfig } from '../platform/config/database.config';
import { AuthModule } from '../domains/auth/auth.module';
import { DocumentModule } from '../domains/document/document.module';
import { FavoriteModule } from '../domains/favorite/favorite.module';
import { MembershipModule } from '../domains/membership/membership.module';
import { PublishModule } from '../domains/publish/publish.module';
import { SearchModule } from '../domains/search/search.module';
import { TeamspaceModule } from '../domains/teamspace/teamspace.module';
import { UserModule } from '../domains/user/user.module';
import { WorkspaceModule } from '../domains/workspace/workspace.module';
import { WorkspacePreferenceModule } from '../domains/workspace-preference/workspace-preference.module';
import { AiModule } from '../integrations/ai/ai.module';
import { AuditModule } from '../integrations/audit/audit.module';
import { CacheModule } from '../integrations/cache/cache.module';
import { HealthModule } from '../platform/health/health.module';
import { MailModule } from '../integrations/mail/mail.module';
import { NotificationModule } from '../integrations/notification/notification.module';
import { ObservabilityModule } from '../platform/observability/observability.module';
import { PaymentModule } from '../integrations/payment/payment.module';
import { QueueModule } from '../integrations/queue/queue.module';
import { RateLimitModule } from '../integrations/rate-limit/rate-limit.module';
import { StorageModule } from '../integrations/storage/storage.module';
import { SseModule } from '../platform/sse/sse.module';
import { WsModule } from '../platform/ws/ws.module';

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
    MikroOrmModule.forMiddleware(),
    AiModule,
    AuditModule,
    CacheModule,
    MailModule,
    NotificationModule,
    PaymentModule,
    QueueModule,
    RateLimitModule,
    StorageModule,

    // ----- platform
    EventEmitterModule.forRoot(),
    HealthModule,
    ObservabilityModule,
    LoggerModule.forRoot(buildPinoLoggerParams('api')),
    RequestContextModule,
    WsModule,
    SseModule,

    // ----- domains
    AuthModule,
    UserModule,
    WorkspaceModule,
    WorkspacePreferenceModule,
    MembershipModule,
    TeamspaceModule,
    DocumentModule,
    FavoriteModule,
    PublishModule,
    SearchModule,
  ],
})
export class AppModule {}
