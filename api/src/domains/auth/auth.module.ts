import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AUTH_CONFIG, buildAuthConfig } from '../../platform/config/auth.config';
import { CacheModule } from '../../integrations/cache/cache.module';
import { AuthSessionRepository } from './app/ports/auth-session.repository';
import { AuthTokenService } from './app/ports/auth-token.service';
import { AuthUserRepository } from './app/ports/auth-user.repository';
import { EmailLoginChallengeRepository } from './app/ports/email-login-challenge.repository';
import { OAuthAccountRepository } from './app/ports/oauth-account.repository';
import { PasswordHasher } from './app/ports/password-hasher';
import { PasswordResetLinkBuilder } from './app/ports/password-reset-link-builder';
import { PasswordResetTokenRepository } from './app/ports/password-reset-token.repository';
import { TokenHasher } from './app/ports/token-hasher';
import { GetCurrentUserUseCase } from './app/use-cases/get-current-user.use-case';
import { LoadAuthenticatedUserUseCase } from './app/use-cases/load-authenticated-user.use-case';
import { LoginUseCase } from './app/use-cases/login.use-case';
import { LogoutUseCase } from './app/use-cases/logout.use-case';
import { RequestPasswordResetUseCase } from './app/use-cases/request-password-reset.use-case';
import { RefreshSessionUseCase } from './app/use-cases/refresh-session.use-case';
import { ResetPasswordUseCase } from './app/use-cases/reset-password.use-case';
import { RegisterUseCase } from './app/use-cases/register.use-case';
import { AuthenticateOAuthUseCase } from './app/use-cases/authenticate-oauth.use-case';
import { StartEmailAuthUseCase } from './app/use-cases/start-email-auth.use-case';
import { IssueSessionUseCase } from './app/use-cases/shared/issue-session.use-case';
import { VerifyEmailAuthUseCase } from './app/use-cases/verify-email-auth.use-case';
import { VerifyResetPasswordTokenUseCase } from './app/use-cases/verify-reset-password-token.use-case';
import { AuthCookieService } from './api/rest/auth-cookie.utils';
import { AuthController } from './api/rest/auth.controller';
import { GithubOAuthGuard } from './api/guard/github-oauth.guard';
import { GoogleOAuthGuard } from './api/guard/google-oauth.guard';
import { JwtAuthGuard } from './api/guard/jwt-auth.guard';
import { PermissionsGuard } from './api/guard/permissions.guard';
import { AuthHttpExceptionFilter } from './api/rest/auth-http-exception.filter';
import { GithubStrategy } from './infra/github.strategy';
import { GoogleStrategy } from './infra/google.strategy';
import { JwtStrategy } from './infra/jwt.strategy';
import { AuthPasswordResetLinkBuilder } from './infra/password-reset-link-builder.service';
import { UserCredentialEntity } from './infra/persistence/entities/user-credential.entity';
import { EmailLoginChallengeEntity } from './infra/persistence/entities/email-login-challenge.entity';
import { EmailVerificationTokenEntity } from './infra/persistence/entities/email-verification-token.entity';
import { MikroOrmAuthSessionRepository } from './infra/persistence/mikro-orm-auth-session.repository';
import { MikroOrmAuthUserRepository } from './infra/persistence/mikro-orm-auth-user.repository';
import { MikroOrmEmailLoginChallengeRepository } from './infra/persistence/mikro-orm-email-login-challenge.repository';
import { MikroOrmOAuthAccountRepository } from './infra/persistence/mikro-orm-oauth-account.repository';
import { MikroOrmPasswordResetTokenRepository } from './infra/persistence/mikro-orm-password-reset-token.repository';
import { OAuthAccountEntity } from './infra/persistence/entities/oauth-account.entity';
import { PermissionEntity } from './infra/persistence/entities/permission.entity';
import { PasswordResetTokenEntity } from './infra/persistence/entities/password-reset-token.entity';
import { RoleEntity } from './infra/persistence/entities/role.entity';
import { RolePermissionEntity } from './infra/persistence/entities/role-permission.entity';
import { BcryptPasswordHasher } from './infra/security/bcrypt-password-hasher';
import { JwtAuthTokenService } from './infra/security/jwt-auth-token.service';
import { Sha256TokenHasher } from './infra/security/sha256-token-hasher';
import { UserSessionEntity } from './infra/persistence/entities/user-session.entity';
import { UserRoleEntity } from './infra/persistence/entities/user-role.entity';
import { IdempotencyModule } from '../../platform/idempotency/idempotency.module';
import { NotificationModule } from '../../integrations/notification/notification.module';
import { StorageModule } from '../../integrations/storage/storage.module';
import {
  buildOAuthProviderConfigs,
  OAUTH_PROVIDER_CONFIGS,
  type OAuthProviderConfigs,
} from './infra/oauth-provider-config';

const authEntities = [
  UserCredentialEntity,
  UserSessionEntity,
  PasswordResetTokenEntity,
  EmailLoginChallengeEntity,
  EmailVerificationTokenEntity,
  OAuthAccountEntity,
  RoleEntity,
  PermissionEntity,
  UserRoleEntity,
  RolePermissionEntity,
];

@Module({
  imports: [
    ConfigModule,
    CacheModule,
    IdempotencyModule,
    NotificationModule,
    StorageModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const authConfig = buildAuthConfig(configService);

        return {
          secret: authConfig.jwtAccessSecret,
          signOptions: {
            expiresIn: authConfig.jwtAccessTtlSeconds,
          },
        };
      },
    }),
    MikroOrmModule.forFeature(authEntities),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: AUTH_CONFIG,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildAuthConfig(configService),
    },
    {
      provide: OAUTH_PROVIDER_CONFIGS,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildOAuthProviderConfigs(configService),
    },
    {
      provide: AuthUserRepository,
      useClass: MikroOrmAuthUserRepository,
    },
    {
      provide: AuthSessionRepository,
      useClass: MikroOrmAuthSessionRepository,
    },
    {
      provide: EmailLoginChallengeRepository,
      useClass: MikroOrmEmailLoginChallengeRepository,
    },
    {
      provide: OAuthAccountRepository,
      useClass: MikroOrmOAuthAccountRepository,
    },
    {
      provide: PasswordHasher,
      useClass: BcryptPasswordHasher,
    },
    {
      provide: PasswordResetTokenRepository,
      useClass: MikroOrmPasswordResetTokenRepository,
    },
    {
      provide: TokenHasher,
      useClass: Sha256TokenHasher,
    },
    {
      provide: PasswordResetLinkBuilder,
      useClass: AuthPasswordResetLinkBuilder,
    },
    {
      provide: AuthTokenService,
      useClass: JwtAuthTokenService,
    },
    AuthenticateOAuthUseCase,
    RegisterUseCase,
    StartEmailAuthUseCase,
    VerifyEmailAuthUseCase,
    LoginUseCase,
    RefreshSessionUseCase,
    LogoutUseCase,
    RequestPasswordResetUseCase,
    VerifyResetPasswordTokenUseCase,
    ResetPasswordUseCase,
    GetCurrentUserUseCase,
    LoadAuthenticatedUserUseCase,
    IssueSessionUseCase,
    AuthCookieService,
    AuthHttpExceptionFilter,
    {
      provide: GoogleStrategy,
      inject: [OAUTH_PROVIDER_CONFIGS],
      useFactory: (oauthProviderConfigs: OAuthProviderConfigs) =>
        oauthProviderConfigs.google.enabled
          ? new GoogleStrategy(oauthProviderConfigs.google)
          : null,
    },
    {
      provide: GithubStrategy,
      inject: [OAUTH_PROVIDER_CONFIGS],
      useFactory: (oauthProviderConfigs: OAuthProviderConfigs) =>
        oauthProviderConfigs.github.enabled
          ? new GithubStrategy(oauthProviderConfigs.github)
          : null,
    },
    GoogleOAuthGuard,
    GithubOAuthGuard,
    JwtStrategy,
    JwtAuthGuard,
    PermissionsGuard,
  ],
  exports: [
    AUTH_CONFIG,
    AuthTokenService,
    JwtAuthGuard,
    LoadAuthenticatedUserUseCase,
    PermissionsGuard,
  ],
})
export class AuthModule {}
