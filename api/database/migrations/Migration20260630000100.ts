import { Migration } from '@mikro-orm/migrations';

export class Migration20260630000100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "document_favorites" (
        "id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "workspace_id" uuid not null,
        "document_id" uuid not null,
        "user_id" uuid not null,
        constraint "document_favorites_pkey" primary key ("id")
      );`,
    );
    this.addSql(
      `alter table "document_favorites"
        add constraint "document_favorites_workspace_id_foreign"
        foreign key ("workspace_id")
        references "workspaces" ("id")
        on update cascade
        on delete cascade;`,
    );
    this.addSql(
      `alter table "document_favorites"
        add constraint "document_favorites_document_id_foreign"
        foreign key ("document_id")
        references "documents" ("id")
        on update cascade
        on delete cascade;`,
    );
    this.addSql(
      `alter table "document_favorites"
        add constraint "document_favorites_user_id_foreign"
        foreign key ("user_id")
        references "users" ("id")
        on update cascade
        on delete cascade;`,
    );
    this.addSql(
      'create unique index "document_favorites_user_id_document_id_unique" on "document_favorites" ("user_id", "document_id");',
    );
    this.addSql(
      'create index "document_favorites_workspace_id_index" on "document_favorites" ("workspace_id");',
    );
    this.addSql(
      'create index "document_favorites_document_id_index" on "document_favorites" ("document_id");',
    );
    this.addSql(
      `create table "published_documents" (
        "id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "workspace_id" uuid not null,
        "document_id" uuid not null,
        "published_by" uuid not null,
        constraint "published_documents_pkey" primary key ("id")
      );`,
    );
    this.addSql(
      `alter table "published_documents"
        add constraint "published_documents_workspace_id_foreign"
        foreign key ("workspace_id")
        references "workspaces" ("id")
        on update cascade
        on delete cascade;`,
    );
    this.addSql(
      `alter table "published_documents"
        add constraint "published_documents_document_id_foreign"
        foreign key ("document_id")
        references "documents" ("id")
        on update cascade
        on delete cascade;`,
    );
    this.addSql(
      `alter table "published_documents"
        add constraint "published_documents_published_by_foreign"
        foreign key ("published_by")
        references "users" ("id")
        on update cascade
        on delete restrict;`,
    );
    this.addSql(
      'create unique index "published_documents_document_id_unique" on "published_documents" ("document_id");',
    );
    this.addSql(
      'create index "published_documents_workspace_id_index" on "published_documents" ("workspace_id");',
    );
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists "published_documents" cascade;');
    this.addSql('drop table if exists "document_favorites" cascade;');
  }
}
