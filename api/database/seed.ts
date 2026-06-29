import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/postgresql';
import { buildDatabaseConfig } from '../src/config/database.config';
import { CurrentUserCredentialEntity } from '../src/modules/domains/auth/infra/persistence/entities/current-user-credential.entity';
import { CurrentUserEntity } from '../src/modules/domains/auth/infra/persistence/entities/current-user.entity';
import { EmailVerificationTokenEntity } from '../src/modules/domains/auth/infra/persistence/entities/email-verification-token.entity';
import { PermissionEntity } from '../src/modules/domains/auth/infra/persistence/entities/permission.entity';
import { PasswordResetTokenEntity } from '../src/modules/domains/auth/infra/persistence/entities/password-reset-token.entity';
import { RoleEntity } from '../src/modules/domains/auth/infra/persistence/entities/role.entity';
import { RolePermissionEntity } from '../src/modules/domains/auth/infra/persistence/entities/role-permission.entity';
import { UserRoleEntity } from '../src/modules/domains/auth/infra/persistence/entities/user-role.entity';
import { UserSessionEntity } from '../src/modules/domains/auth/infra/persistence/entities/user-session.entity';
import { seedAuth } from './seeds/auth.seed';

function formatDuration(ms: number): string {
  if (ms < 1_000) {
    return `${ms}ms`;
  }

  return `${(ms / 1_000).toFixed(1)}s`;
}

async function runSeedStep<T>(label: string, work: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  console.log(`[seed] ${label}...`);

  const result = await work();

  console.log(`[seed] ${label} done in ${formatDuration(Date.now() - startedAt)}`);
  return result;
}

async function main() {
  const seedStartedAt = Date.now();
  console.log('[seed] Starting demo seed');

  const orm = await MikroORM.init({
    ...buildDatabaseConfig(process.env, { debug: false }),
    entities: [
      CurrentUserEntity,
      CurrentUserCredentialEntity,
      UserSessionEntity,
      PasswordResetTokenEntity,
      EmailVerificationTokenEntity,
      RoleEntity,
      PermissionEntity,
      UserRoleEntity,
      RolePermissionEntity,
    ],
  });

  try {
    const em = orm.em.fork();

    await runSeedStep('Applying migrations', async () => orm.getMigrator().up());
    await runSeedStep('Seeding auth', async () => seedAuth(em));

    console.log('Seed completed');
    console.log(`[seed] Total duration: ${formatDuration(Date.now() - seedStartedAt)}`);
  }
  finally {
    await orm.close(true);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
