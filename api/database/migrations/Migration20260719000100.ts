import { Migration } from '@mikro-orm/migrations';

export class Migration20260719000100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table "document_collaboration_snapshots" (
        "id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "document_id" uuid not null,
        "snapshot" bytea not null,
        "sequence" integer not null default 0,
        "latest_sequence" integer not null default 0,
        "projection_sequence" integer not null default 0,
        constraint "document_collaboration_snapshots_pkey" primary key ("id"),
        constraint "document_collaboration_snapshots_document_id_unique" unique ("document_id"),
        constraint "document_collaboration_snapshots_document_id_foreign"
          foreign key ("document_id") references "documents" ("id") on delete cascade
      );
    `);
    this.addSql(`
      create table "document_collaboration_updates" (
        "id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "document_id" uuid not null,
        "sequence" integer not null,
        "update_hash" varchar(64) not null,
        "update" bytea not null,
        constraint "document_collaboration_updates_pkey" primary key ("id"),
        constraint "document_collaboration_updates_document_sequence_unique"
          unique ("document_id", "sequence"),
        constraint "document_collaboration_updates_document_hash_unique"
          unique ("document_id", "update_hash"),
        constraint "document_collaboration_updates_document_id_foreign"
          foreign key ("document_id") references "documents" ("id") on delete cascade
      );
    `);
    this.addSql(
      'create index "document_collaboration_updates_document_sequence_index" on "document_collaboration_updates" ("document_id", "sequence");',
    );
  }
}
