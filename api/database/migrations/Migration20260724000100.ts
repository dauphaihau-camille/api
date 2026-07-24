import { Migration } from '@mikro-orm/migrations';

export class Migration20260724000100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table "document_invitations" (
        "id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "version" int not null default 1,
        "workspace_id" uuid not null,
        "document_id" uuid not null,
        "email" varchar(255) not null,
        "permission" text not null,
        "invited_by" uuid not null,
        "accepted_by" uuid null,
        "accepted_at" timestamptz null,
        "revoked_at" timestamptz null,
        constraint "document_invitations_pkey" primary key ("id")
      );
    `);
    this.addSql(`
      alter table "document_invitations"
        add constraint "document_invitations_permission_check"
        check ("permission" in ('view', 'comment', 'edit', 'manage'));
    `);
    this.addSql(`
      alter table "document_invitations"
        add constraint "document_invitations_workspace_id_foreign"
        foreign key ("workspace_id")
        references "workspaces" ("id")
        on update cascade
        on delete cascade;
    `);
    this.addSql(`
      alter table "document_invitations"
        add constraint "document_invitations_document_id_foreign"
        foreign key ("document_id")
        references "documents" ("id")
        on update cascade
        on delete cascade;
    `);
    this.addSql(`
      alter table "document_invitations"
        add constraint "document_invitations_invited_by_foreign"
        foreign key ("invited_by")
        references "users" ("id")
        on update cascade
        on delete restrict;
    `);
    this.addSql(`
      alter table "document_invitations"
        add constraint "document_invitations_accepted_by_foreign"
        foreign key ("accepted_by")
        references "users" ("id")
        on update cascade
        on delete set null;
    `);
    this.addSql('create unique index "document_invitations_document_id_email_unique" on "document_invitations" ("document_id", "email");');
    this.addSql('create index "document_invitations_workspace_id_index" on "document_invitations" ("workspace_id");');
    this.addSql('create index "document_invitations_email_index" on "document_invitations" ("email");');
    this.addSql('create index "document_invitations_revoked_at_index" on "document_invitations" ("revoked_at");');
    this.addSql('create index "document_invitations_accepted_at_index" on "document_invitations" ("accepted_at");');
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists "document_invitations" cascade;');
  }
}
