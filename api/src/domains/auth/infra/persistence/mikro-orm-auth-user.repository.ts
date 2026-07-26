import { LockMode, OptimisticLockError } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { StorageService } from '~/integrations/storage/app/ports/storage.service';
import { resolveUserAvatarUrl } from '~/integrations/storage/app/user-avatar-url.util';
import {
  AuthUserRepository,
  CreateUserAccountInput,
  LoginUserAccount,
  UpdateUserAccountInput,
  UserAccountVersionConflictError,
} from '../../app/ports/auth-user.repository';
import type { RoleDefinition } from '../../domain/models/role-definition';
import type { UserAccount } from '../../domain/models/user-account';
import { Email } from '../../domain/value-objects/email';
import { PasswordHash } from '../../domain/value-objects/password-hash';
import { PermissionKey } from '../../domain/value-objects/permission-key';
import { RoleKey } from '../../domain/value-objects/role-key';
import { CurrentUserCredentialEntity } from './entities/current-user-credential.entity';
import { CurrentUserEntity } from './entities/current-user.entity';
import { RoleEntity } from './entities/role.entity';
import { UserRoleEntity } from './entities/user-role.entity';

@Injectable()
export class MikroOrmAuthUserRepository implements AuthUserRepository {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly storageService: StorageService,
  ) {}

  async findByEmail(email: Email): Promise<UserAccount | null> {
    const userRepository = this.entityManager.fork().getRepository(CurrentUserEntity);
    const user = await userRepository.findOne(
      { email: email.toString() },
      { populate: ['credential', 'userRoles.role.rolePermissions.permission'] },
    );

    return user ? this.toUserAccount(user) : null;
  }

  async findLoginByEmail(email: Email): Promise<LoginUserAccount | null> {
    const userRepository = this.entityManager.fork().getRepository(CurrentUserEntity);
    const user = await userRepository.findOne(
      { email: email.toString() },
      { populate: ['credential'] },
    );

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      status: user.status,
      passwordHash: user.credential
        ? PasswordHash.fromPersisted(user.credential.passwordHash)
        : undefined,
    };
  }

  async findById(id: string): Promise<UserAccount | null> {
    const userRepository = this.entityManager.fork().getRepository(CurrentUserEntity);
    const user = await userRepository.findOne(
      { id },
      { populate: ['credential', 'userRoles.role.rolePermissions.permission'] },
    );

    return user ? this.toUserAccount(user) : null;
  }

  async create(input: CreateUserAccountInput): Promise<UserAccount> {
    const entityManager = this.entityManager.fork();
    const userRepository = entityManager.getRepository(CurrentUserEntity);
    const user = userRepository.create({
      email: input.email.toString(),
      displayName: input.displayName,
      avatarSourceType: input.avatarSourceType,
      avatarSourceUrl: input.avatarSourceUrl,
      avatarStorageKey: input.avatarStorageKey,
      status: input.status,
      emailVerifiedAt: input.emailVerifiedAt,
    });

    if (input.passwordHash && input.passwordUpdatedAt) {
      const credentialRepository = entityManager.getRepository(
        CurrentUserCredentialEntity,
      );
      const credential = credentialRepository.create({
        user,
        passwordHash: input.passwordHash.toString(),
        passwordUpdatedAt: input.passwordUpdatedAt,
      });

      user.credential = credential;
      await entityManager.persist([user, credential]).flush();
    }
    else {
      await entityManager.persist(user).flush();
    }

    return this.toUserAccount(user);
  }

  async update(id: string, input: UpdateUserAccountInput): Promise<UserAccount | null> {
    const entityManager = this.entityManager.fork();
    const userRepository = entityManager.getRepository(CurrentUserEntity);
    try {
      const user = await userRepository.findOne({ id }, {
        populate: ['credential', 'userRoles.role.rolePermissions.permission'],
        lockMode: LockMode.OPTIMISTIC,
        lockVersion: input.version,
      });

      if (!user) {
        return null;
      }

      if (input.displayName !== undefined) {
        user.displayName = input.displayName;
      }

      if (input.avatarSourceType !== undefined) {
        user.avatarSourceType = input.avatarSourceType ?? undefined;
      }

      if (input.avatarSourceUrl !== undefined) {
        user.avatarSourceUrl = input.avatarSourceUrl ?? undefined;
      }

      if (input.avatarStorageKey !== undefined) {
        user.avatarStorageKey = input.avatarStorageKey ?? undefined;
      }

      if (input.status !== undefined) {
        user.status = input.status;
      }

      await entityManager.persist(user).flush();

      return this.toUserAccount(user);
    }
    catch (error) {
      if (error instanceof OptimisticLockError) {
        throw new UserAccountVersionConflictError();
      }

      throw error;
    }
  }

  async updatePassword(input: {
    userId: string;
    passwordHash: PasswordHash;
    passwordUpdatedAt: Date;
  }): Promise<void> {
    const entityManager = this.entityManager.fork();
    const credentialRepository = entityManager.getRepository(
      CurrentUserCredentialEntity,
    );
    const credential = await credentialRepository.findOneOrFail({
      user: input.userId,
    });

    credential.passwordHash = input.passwordHash.toString();
    credential.passwordUpdatedAt = input.passwordUpdatedAt;

    await entityManager.flush();
  }

  async setEmailVerifiedAt(userId: string, emailVerifiedAt: Date): Promise<void> {
    const entityManager = this.entityManager.fork();
    const userRepository = entityManager.getRepository(CurrentUserEntity);
    const user = await userRepository.findOneOrFail({ id: userId });

    user.emailVerifiedAt = emailVerifiedAt;

    await entityManager.flush();
  }

  async assignRole(userId: string, roleKey: RoleKey): Promise<void> {
    const entityManager = this.entityManager.fork();
    const userRepository = entityManager.getRepository(CurrentUserEntity);
    const roleRepository = entityManager.getRepository(RoleEntity);
    const userRoleRepository = entityManager.getRepository(UserRoleEntity);
    const user = await userRepository.findOneOrFail({ id: userId });
    const role = await roleRepository.findOneOrFail({
      key: roleKey.toString(),
    });
    const existingUserRole = await userRoleRepository.findOne({
      user,
      role,
    });

    if (existingUserRole) {
      return;
    }

    const userRole = userRoleRepository.create({
      user,
      role,
      assignedAt: new Date(),
    });

    await entityManager.persist(userRole).flush();
  }

  async ensureRole(roleDefinition: RoleDefinition): Promise<void> {
    const entityManager = this.entityManager.fork();
    const roleRepository = entityManager.getRepository(RoleEntity);
    const existingRole = await roleRepository.findOne({
      key: roleDefinition.key.toString(),
    });

    if (existingRole) {
      return;
    }

    const role = roleRepository.create({
      key: roleDefinition.key.toString(),
      name: roleDefinition.name,
      description: roleDefinition.description,
    });
    await entityManager.persist(role).flush();
  }

  private toUserAccount(user: CurrentUserEntity): UserAccount {
    const avatar = resolveUserAvatarUrl(user, this.storageService);
    const roles = user.userRoles
      .getItems()
      .map((userRole) => RoleKey.create(userRole.role.key))
      .sort((left, right) => left.toString().localeCompare(right.toString()));
    const permissions = Array.from(
      new Map(
        user.userRoles.getItems().flatMap((userRole) =>
          userRole.role.rolePermissions.getItems().map((rolePermission) => {
            const key = PermissionKey.create(rolePermission.permission.key);
            return [key.toString(), key] as const;
          }),
        ),
      ).values(),
    ).sort((left, right) => left.toString().localeCompare(right.toString()));

    return {
      id: user.id,
      version: user.version,
      email: Email.create(user.email),
      displayName: user.displayName,
      ...(avatar ? { avatar } : {}),
      avatarSourceType: user.avatarSourceType,
      avatarSourceUrl: user.avatarSourceUrl,
      avatarStorageKey: user.avatarStorageKey,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      passwordHash: user.credential
        ? PasswordHash.fromPersisted(user.credential.passwordHash)
        : undefined,
      passwordUpdatedAt: user.credential?.passwordUpdatedAt,
      roles,
      permissions,
    };
  }
}
