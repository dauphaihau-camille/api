import { Migration } from '@mikro-orm/migrations';

export class Migration20260629000200 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "teamspaces" (
        "id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "version" int not null default 1,
        "workspace_id" uuid not null,
        "name" varchar(255) not null,
        "description" varchar(255) null,
        constraint "teamspaces_pkey" primary key ("id")
      );`,
    );
    this.addSql(
      `alter table "teamspaces"
        add constraint "teamspaces_workspace_id_foreign"
        foreign key ("workspace_id")
        references "workspaces" ("id")
        on update cascade
        on delete cascade;`,
    );
    this.addSql(
      'create index "teamspaces_workspace_id_index" on "teamspaces" ("workspace_id");',
    );
    this.addSql(
      'create index "teamspaces_name_index" on "teamspaces" ("name");',
    );
    this.addSql(
      `create table "documents" (
        "id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "version" int not null default 1,
        "workspace_id" uuid not null,
        "teamspace_id" uuid null,
        "parent_document_id" uuid null,
        "title" varchar(255) not null,
        "content_format" varchar(255) not null,
        "content_json" jsonb not null,
        "sort_key" int not null default 0,
        "archived_at" timestamptz null,
        "created_by" uuid not null,
        "updated_by" uuid not null,
        constraint "documents_pkey" primary key ("id")
      );`,
    );
    this.addSql(
      `alter table "documents"
        add constraint "documents_workspace_id_foreign"
        foreign key ("workspace_id")
        references "workspaces" ("id")
        on update cascade
        on delete cascade;`,
    );
    this.addSql(
      `alter table "documents"
        add constraint "documents_teamspace_id_foreign"
        foreign key ("teamspace_id")
        references "teamspaces" ("id")
        on update cascade
        on delete set null;`,
    );
    this.addSql(
      `alter table "documents"
        add constraint "documents_parent_document_id_foreign"
        foreign key ("parent_document_id")
        references "documents" ("id")
        on update cascade
        on delete set null;`,
    );
    this.addSql(
      `alter table "documents"
        add constraint "documents_created_by_foreign"
        foreign key ("created_by")
        references "users" ("id")
        on update cascade
        on delete restrict;`,
    );
    this.addSql(
      `alter table "documents"
        add constraint "documents_updated_by_foreign"
        foreign key ("updated_by")
        references "users" ("id")
        on update cascade
        on delete restrict;`,
    );
    this.addSql(
      'create index "documents_workspace_id_index" on "documents" ("workspace_id");',
    );
    this.addSql(
      'create index "documents_teamspace_id_index" on "documents" ("teamspace_id");',
    );
    this.addSql(
      'create index "documents_parent_document_id_index" on "documents" ("parent_document_id");',
    );
    this.addSql(
      'create index "documents_archived_at_index" on "documents" ("archived_at");',
    );
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists "documents" cascade;');
    this.addSql('drop table if exists "teamspaces" cascade;');
  }
}
