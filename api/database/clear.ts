import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/postgresql';
import { buildDatabaseConfig } from '../src/config/database.config';

async function main() {
  const orm = await MikroORM.init(
    buildDatabaseConfig(process.env, { includeEntityGlobs: true, debug: false }),
  );

  try {
    const generator = orm.getSchemaGenerator();

    console.log('[db:clear] Dropping database schema');
    await generator.dropSchema({ dropMigrationsTable: true });
    console.log('[db:clear] Schema dropped');
  }
  finally {
    await orm.close(true);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
