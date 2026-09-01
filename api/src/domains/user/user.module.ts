import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AUTH_CONFIG, buildAuthConfig } from '../../platform/config/auth.config';
import { CacheModule } from '../../integrations/cache/cache.module';
import { QueueModule } from '../../integrations/queue/queue.module';
import { StorageModule } from '../../integrations/storage/storage.module';
import { UserEntity } from './infra/persistence/entities/user.entity';
import { UserCredentialEntity } from '../auth/infra/persistence/entities/user-credential.entity';
import { PermissionEntity } from '../auth/infra/persistence/entities/permission.entity';
import { RoleEntity } from '../auth/infra/persistence/entities/role.entity';
import { RolePermissionEntity } from '../auth/infra/persistence/entities/role-permission.entity';
import { UserRoleEntity } from '../auth/infra/persistence/entities/user-role.entity';
import { AuthUserRepository } from '../auth/app/ports/auth-user.repository';
import { PasswordHasher } from '../auth/app/ports/password-hasher';
import { MikroOrmAuthUserRepository } from '../auth/infra/persistence/mikro-orm-auth-user.repository';
import { BcryptPasswordHasher } from '../auth/infra/security/bcrypt-password-hasher';
import { UserRepository } from './app/ports/user.repository';
import { CreateUserUseCase } from './app/use-cases/create-user.use-case';
import { GetUserByIdUseCase } from './app/use-cases/get-user-by-id.use-case';
import { ListUsersUseCase } from './app/use-cases/list-users.use-case';
import { UpdateUserUseCase } from './app/use-cases/update-user.use-case';
import { UserController } from './api/rest/user.controller';
import { MikroOrmUserRepository } from './infra/mikro-orm-user.repository';
import { InvalidateUserCacheOnUserCreatedListener } from './listeners/invalidate-user-cache-on-user-created.listener';
import { InvalidateUserCacheOnUserUpdatedListener } from './listeners/invalidate-user-cache-on-user-updated.listener';
import { SendWelcomeEmailOnUserCreatedListener } from './listeners/send-welcome-email-on-user-created.listener';

@Module({
  imports: [
    ConfigModule,
    CacheModule,
    QueueModule,
    StorageModule,
    MikroOrmModule.forFeature([
      UserEntity,
      UserCredentialEntity,
      RoleEntity,
      PermissionEntity,
      UserRoleEntity,
      RolePermissionEntity,
    ]),
  ],
  controllers: [UserController],
  providers: [
    {
      provide: AUTH_CONFIG,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildAuthConfig(configService),
    },
    {
      provide: AuthUserRepository,
      useClass: MikroOrmAuthUserRepository,
    },
    {
      provide: PasswordHasher,
      useClass: BcryptPasswordHasher,
    },
    {
      provide: UserRepository,
      useClass: MikroOrmUserRepository,
    },
    CreateUserUseCase,
    GetUserByIdUseCase,
    ListUsersUseCase,
    UpdateUserUseCase,
    InvalidateUserCacheOnUserCreatedListener,
    InvalidateUserCacheOnUserUpdatedListener,
    SendWelcomeEmailOnUserCreatedListener,
  ],
})
export class UserModule {}
