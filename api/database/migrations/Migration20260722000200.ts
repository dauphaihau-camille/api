import { Migration } from '@mikro-orm/migrations';

export class Migration20260722000200 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table "document_access_settings" (
        "id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "version" int not null default 1,
        "workspace_id" uuid not null,
        "document_id" uuid not null,
        "workspace_member_permission" text null,
        "updated_by" uuid not null,
        constraint "document_access_settings_pkey" primary key ("id")
      );
    `);
    this.addSql(`
      alter table "document_access_settings"
        add constraint "document_access_settings_workspace_member_permission_check"
        check ("workspace_member_permission" is null or "workspace_member_permission" in ('view', 'comment', 'edit', 'manage'));
    `);
    this.addSql(`
      alter table "document_access_settings"
        add constraint "document_access_settings_workspace_id_foreign"
        foreign key ("workspace_id")
        references "workspaces" ("id")
        on update cascade
        on delete cascade;
    `);
    this.addSql(`
      alter table "document_access_settings"
        add constraint "document_access_settings_document_id_foreign"
        foreign key ("document_id")
        references "documents" ("id")
        on update cascade
        on delete cascade;
    `);
    this.addSql(`
      alter table "document_access_settings"
        add constraint "document_access_settings_updated_by_foreign"
        foreign key ("updated_by")
        references "users" ("id")
        on update cascade
        on delete restrict;
    `);
    this.addSql('create unique index "document_access_settings_document_id_unique" on "document_access_settings" ("document_id");');
    this.addSql('create index "document_access_settings_workspace_id_index" on "document_access_settings" ("workspace_id");');
    this.addSql('create index "document_access_settings_workspace_member_permission_index" on "document_access_settings" ("workspace_member_permission");');
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists "document_access_settings" cascade;');
  }
}
