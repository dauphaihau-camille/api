import type { EntityManager } from '@mikro-orm/postgresql';
import { buildAuthConfig } from '../../../src/platform/config/auth.config';
import { UserStatus } from '../../../src/domains/auth/domain/enums/user-status.enum';
import { CurrentUserCredentialEntity } from '../../../src/domains/auth/infra/persistence/entities/current-user-credential.entity';
import { CurrentUserEntity } from '../../../src/domains/auth/infra/persistence/entities/current-user.entity';
import { UserRoleEntity } from '../../../src/domains/auth/infra/persistence/entities/user-role.entity';
import { BcryptPasswordHasher } from '../../../src/domains/auth/infra/security/bcrypt-password-hasher';
import { REALISTIC_USER_FIXTURES } from '../fixtures/realistic.fixtures';
import { seedAuth, seedAuthReferenceData } from '../auth.seed';
import type { SeedUserSummary } from './realistic-seed.types';

function resolveSeedBcryptSaltRounds(defaultRounds: number): number {
  const configuredRounds = Number(process.env.SEED_BCRYPT_SALT_ROUNDS ?? '4');

  if (Number.isFinite(configuredRounds) && configuredRounds > 0) {
    return configuredRounds;
  }

  return Math.min(defaultRounds, 4);
}

export async function seedRealisticUsers(em: EntityManager, password: string): Promise<SeedUserSummary[]> {
  const seededAuth = await seedAuth(em);
  const { roleByKey } = await seedAuthReferenceData(em);
  const memberRole = roleByKey.get('member');
  const adminRole = roleByKey.get('admin');

  if (!memberRole || !adminRole) {
    throw new Error('Realistic seed requires both admin and member auth roles');
  }

  const authConfig = buildAuthConfig({
    get(key: string) {
      return process.env[key];
    },
  });
  const passwordService = new BcryptPasswordHasher({
    ...authConfig,
    bcryptSaltRounds: resolveSeedBcryptSaltRounds(authConfig.bcryptSaltRounds),
  });
  const passwordHash = await passwordService.hash(password);
  const fixtureEmails = REALISTIC_USER_FIXTURES.map((fixture) => fixture.email);
  const existingUsers =
    fixtureEmails.length > 0
      ? await em.find(CurrentUserEntity, { email: { $in: fixtureEmails } }, { populate: ['credential'] })
      : [];
  const existingUsersByEmail = new Map(existingUsers.map((user) => [user.email, user]));
  const existingUserRoles =
    fixtureEmails.length > 0
      ? await em.find(UserRoleEntity, { user: { email: { $in: fixtureEmails } } }, { populate: ['user', 'role'] })
      : [];
  const existingUserRoleKeys = new Set(
    existingUserRoles.map((userRole) => `${userRole.user.email}::${userRole.role.key}`),
  );

  for (const fixture of REALISTIC_USER_FIXTURES) {
    let user = existingUsersByEmail.get(fixture.email);

    if (!user) {
      user = em.create(CurrentUserEntity, {
        email: fixture.email,
        displayName: fixture.displayName,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      });
      existingUsersByEmail.set(fixture.email, user);
    }
    else {
      user.displayName = fixture.displayName;
      user.status = UserStatus.ACTIVE;
      user.emailVerifiedAt = new Date();
    }

    if (!user.credential) {
      user.credential = em.create(CurrentUserCredentialEntity, {
        user,
        passwordHash,
        passwordUpdatedAt: new Date(),
      });
    }
    else {
      user.credential.passwordHash = passwordHash;
      user.credential.passwordUpdatedAt = new Date();
    }

    const role = fixture.role === 'admin' ? adminRole : memberRole;
    const roleKey = `${user.email}::${role.key}`;

    if (!existingUserRoleKeys.has(roleKey)) {
      em.persist(
        em.create(UserRoleEntity, {
          user,
          role,
          assignedAt: new Date(),
        }),
      );
      existingUserRoleKeys.add(roleKey);
    }

    em.persist(user);
  }

  await em.flush();

  return [
    ...Array.from(seededAuth.usersByEmail.values()).map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName ?? user.email,
    })),
    ...REALISTIC_USER_FIXTURES.map((fixture) => {
      const user = existingUsersByEmail.get(fixture.email)!;
      return {
        id: user.id,
        email: user.email,
        displayName: user.displayName ?? user.email,
      };
    }),
  ];
}
