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
import { DocumentEntity } from '../src/modules/domains/document/infra/persistence/entities/document.entity';
import { DocumentSubdocReferenceEntity } from '../src/modules/domains/document/infra/persistence/entities/document-subdoc-reference.entity';
import { DocumentVisitEntity } from '../src/modules/domains/document/infra/persistence/entities/document-visit.entity';
import { DocumentFavoriteEntity } from '../src/modules/domains/favorite/infra/persistence/entities/document-favorite.entity';
import { PublishedDocumentEntity } from '../src/modules/domains/publish/infra/persistence/entities/published-document.entity';
import { TeamspaceEntity } from '../src/modules/domains/teamspace/infra/persistence/entities/teamspace.entity';
import { WorkspaceEntity } from '../src/modules/domains/workspace/infra/persistence/entities/workspace.entity';
import { WorkspaceMemberEntity } from '../src/modules/domains/workspace/infra/persistence/entities/workspace-member.entity';
import { WorkspacePreferenceEntity } from '../src/modules/domains/workspace-preference/infra/persistence/entities/workspace-preference.entity';
import { seedHugeData } from './seeds/huge.seed';

function formatDuration(ms: number): string {
  if (ms < 1_000) {
    return `${ms}ms`;
  }

  return `${(ms / 1_000).toFixed(1)}s`;
}

async function main() {
  const startedAt = Date.now();
  console.log('[seed] Starting huge synthetic seed');

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
      WorkspaceEntity,
      WorkspaceMemberEntity,
      TeamspaceEntity,
      DocumentEntity,
      DocumentFavoriteEntity,
      DocumentVisitEntity,
      PublishedDocumentEntity,
      DocumentSubdocReferenceEntity,
      WorkspacePreferenceEntity,
    ],
  });

  try {
    const em = orm.em.fork();

    await orm.getMigrator().up();
    await seedHugeData(em);

    console.log('Huge synthetic seed completed');
    console.log(`[seed] Total duration: ${formatDuration(Date.now() - startedAt)}`);
  }
  finally {
    await orm.close(true);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
