import { Migration } from '@mikro-orm/migrations';

export class Migration20260722000100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table "document_access_grants" (
        "id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "version" int not null default 1,
        "workspace_id" uuid not null,
        "document_id" uuid not null,
        "user_id" uuid not null,
        "permission" text not null,
        "granted_by" uuid not null,
        "revoked_at" timestamptz null,
        constraint "document_access_grants_pkey" primary key ("id")
      );
    `);
    this.addSql(`
      alter table "document_access_grants"
        add constraint "document_access_grants_permission_check"
        check ("permission" in ('view', 'comment', 'edit', 'manage'));
    `);
    this.addSql(`
      alter table "document_access_grants"
        add constraint "document_access_grants_workspace_id_foreign"
        foreign key ("workspace_id")
        references "workspaces" ("id")
        on update cascade
        on delete cascade;
    `);
    this.addSql(`
      alter table "document_access_grants"
        add constraint "document_access_grants_document_id_foreign"
        foreign key ("document_id")
        references "documents" ("id")
        on update cascade
        on delete cascade;
    `);
    this.addSql(`
      alter table "document_access_grants"
        add constraint "document_access_grants_user_id_foreign"
        foreign key ("user_id")
        references "users" ("id")
        on update cascade
        on delete cascade;
    `);
    this.addSql(`
      alter table "document_access_grants"
        add constraint "document_access_grants_granted_by_foreign"
        foreign key ("granted_by")
        references "users" ("id")
        on update cascade
        on delete restrict;
    `);
    this.addSql('create unique index "document_access_grants_document_id_user_id_unique" on "document_access_grants" ("document_id", "user_id");');
    this.addSql('create index "document_access_grants_workspace_id_index" on "document_access_grants" ("workspace_id");');
    this.addSql('create index "document_access_grants_document_id_index" on "document_access_grants" ("document_id");');
    this.addSql('create index "document_access_grants_user_id_index" on "document_access_grants" ("user_id");');
    this.addSql('create index "document_access_grants_active_document_id_index" on "document_access_grants" ("document_id") where "revoked_at" is null;');
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists "document_access_grants" cascade;');
  }
}
