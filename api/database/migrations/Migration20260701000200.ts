import { Migration } from '@mikro-orm/migrations';

export class Migration20260701000200 extends Migration {
  override async up(): Promise<void> {
    this.addSql('alter table "documents" add column "public_id" varchar(255) null;');
    this.addSql('update "documents" set "public_id" = md5("id"::text) where "public_id" is null;');
    this.addSql('alter table "documents" alter column "public_id" set not null;');
    this.addSql('create unique index "documents_public_id_unique" on "documents" ("public_id");');
  }

  override async down(): Promise<void> {
    this.addSql('drop index if exists "documents_public_id_unique";');
    this.addSql('alter table "documents" drop column "public_id";');
  }
}
