import { Migration } from '@mikro-orm/migrations';

export class Migration20260715000100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "workspace_user_preferences"
        add column "last_active_at" timestamptz null;`,
    );
    this.addSql(
      `create index "workspace_user_preferences_user_id_last_active_at_index"
        on "workspace_user_preferences" ("user_id", "last_active_at");`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      'drop index if exists "workspace_user_preferences_user_id_last_active_at_index";',
    );
    this.addSql(
      'alter table "workspace_user_preferences" drop column if exists "last_active_at";',
    );
  }
  }
