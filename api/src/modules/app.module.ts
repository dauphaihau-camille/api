import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { LoggerModule } from 'nestjs-pino';
import { buildPinoLoggerParams } from '../common/logging/pino-logger.config';
import { RequestContextModule } from './shared/request-context/request-context.module';
import { InvalidateUserCacheOnUserCreatedListener } from '../common/listeners/invalidate-user-cache-on-user-created.listener';
import { InvalidateUserCacheOnUserUpdatedListener } from '../common/listeners/invalidate-user-cache-on-user-updated.listener';
import { SendWelcomeEmailOnUserCreatedListener } from '../common/listeners/send-welcome-email-on-user-created.listener';
import { validateAppEnv } from '../config/app-env.config';
import { buildDatabaseConfig } from '../config/database.config';
import { AuthModule } from './domains/auth/auth.module';
import { DocumentModule } from './domains/document/document.module';
import { FavoriteModule } from './domains/favorite/favorite.module';
import { MembershipModule } from './domains/membership/membership.module';
import { PublishModule } from './domains/publish/publish.module';
import { SearchModule } from './domains/search/search.module';
import { TeamspaceModule } from './domains/teamspace/teamspace.module';
import { UserModule } from './domains/user/user.module';
import { WorkspaceModule } from './domains/workspace/workspace.module';
import { WorkspacePreferenceModule } from './domains/workspace-preference/workspace-preference.module';
import { AiModule } from './shared/ai/ai.module';
import { AuditModule } from './shared/audit/audit.module';
import { CacheModule } from './shared/cache/cache.module';
import { HealthModule } from './shared/health/health.module';
import { MailModule } from './shared/mail/mail.module';
import { NotificationModule } from './shared/notification/notification.module';
import { ObservabilityModule } from './shared/observability/observability.module';
import { PaymentModule } from './shared/payment/payment.module';
import { QueueModule } from './shared/queue/queue.module';
import { RateLimitModule } from './shared/rate-limit/rate-limit.module';
import { StorageModule } from './shared/storage/storage.module';
import { SseModule } from './shared/sse/sse.module';
import { WsModule } from './shared/ws/ws.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateAppEnv,
    }),

    // ------ shared
    LoggerModule.forRoot(buildPinoLoggerParams('api')),
    RequestContextModule,
    EventEmitterModule.forRoot(),
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
    SseModule,
    StorageModule,
    WsModule,
    HealthModule,
    ObservabilityModule,

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
  providers: [
    InvalidateUserCacheOnUserCreatedListener,
    InvalidateUserCacheOnUserUpdatedListener,
    SendWelcomeEmailOnUserCreatedListener,
  ],
})
export class AppModule {}
