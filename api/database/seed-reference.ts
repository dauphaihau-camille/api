import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/postgresql';
import { buildDatabaseConfig } from '../src/config/database.config';
import { PermissionEntity } from '../src/modules/domains/auth/infra/persistence/entities/permission.entity';
import { RoleEntity } from '../src/modules/domains/auth/infra/persistence/entities/role.entity';
import { RolePermissionEntity } from '../src/modules/domains/auth/infra/persistence/entities/role-permission.entity';
import { seedAuthReferenceData } from './seeds/auth.seed';

async function main() {
  const orm = await MikroORM.init({
    ...buildDatabaseConfig(process.env, { debug: false }),
    entities: [RoleEntity, PermissionEntity, RolePermissionEntity],
  });

  try {
    const em = orm.em.fork();

    await orm.getMigrator().up();
    await seedAuthReferenceData(em);

    console.log('Production seed completed');
    console.log('Seeded reference data only: roles, permissions');
  }
  finally {
    await orm.close(true);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
