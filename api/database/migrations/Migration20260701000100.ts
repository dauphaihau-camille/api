import { Migration } from '@mikro-orm/migrations';

export class Migration20260701000100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "document_subdoc_references" (
        "id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "workspace_id" uuid not null,
        "source_document_id" uuid not null,
        "target_document_id" uuid not null,
        constraint "document_subdoc_references_pkey" primary key ("id")
      );`,
    );
    this.addSql(
      `alter table "document_subdoc_references"
        add constraint "document_subdoc_references_workspace_id_foreign"
        foreign key ("workspace_id")
        references "workspaces" ("id")
        on update cascade
        on delete cascade;`,
    );
    this.addSql(
      `alter table "document_subdoc_references"
        add constraint "document_subdoc_references_source_document_id_foreign"
        foreign key ("source_document_id")
        references "documents" ("id")
        on update cascade
        on delete cascade;`,
    );
    this.addSql(
      `alter table "document_subdoc_references"
        add constraint "document_subdoc_references_target_document_id_foreign"
        foreign key ("target_document_id")
        references "documents" ("id")
        on update cascade
        on delete cascade;`,
    );
    this.addSql(
      'create unique index "document_subdoc_references_source_document_id_target_document_id_unique" on "document_subdoc_references" ("source_document_id", "target_document_id");',
    );
    this.addSql(
      'create index "document_subdoc_references_workspace_id_index" on "document_subdoc_references" ("workspace_id");',
    );
    this.addSql(
      'create index "document_subdoc_references_target_document_id_index" on "document_subdoc_references" ("target_document_id");',
    );
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists "document_subdoc_references" cascade;');
  }
}
