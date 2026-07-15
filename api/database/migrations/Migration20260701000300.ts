import { Migration } from '@mikro-orm/migrations';

export class Migration20260701000300 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "workspace_user_preferences" (
        "id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "user_id" uuid not null,
        "workspace_id" uuid not null,
        "expanded_document_ids" jsonb not null,
        constraint "workspace_user_preferences_pkey" primary key ("id")
      );`,
    );
    this.addSql(
      `alter table "workspace_user_preferences"
        add constraint "workspace_user_preferences_user_id_foreign"
        foreign key ("user_id")
        references "users" ("id")
        on update cascade
        on delete cascade;`,
    );
    this.addSql(
      `alter table "workspace_user_preferences"
        add constraint "workspace_user_preferences_workspace_id_foreign"
        foreign key ("workspace_id")
        references "workspaces" ("id")
        on update cascade
        on delete cascade;`,
    );
    this.addSql(
      'create unique index "workspace_user_preferences_user_id_workspace_id_unique" on "workspace_user_preferences" ("user_id", "workspace_id");',
    );
    this.addSql(
      'create index "workspace_user_preferences_workspace_id_index" on "workspace_user_preferences" ("workspace_id");',
    );
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists "workspace_user_preferences" cascade;');
  }
}
