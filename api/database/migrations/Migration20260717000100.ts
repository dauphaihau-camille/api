import { Migration } from '@mikro-orm/migrations';

export class Migration20260717000100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "users"
        add column "avatar_source_type" varchar(255) null,
        add column "avatar_source_url" varchar(255) null,
        add column "avatar_storage_key" varchar(255) null;`,
    );
    this.addSql(
      `update "users"
        set
          "avatar_source_type" = case
            when "avatar" like 'http://%' or "avatar" like 'https://%' then 'external'
            when "avatar" is not null then 'internal'
            else null
          end,
          "avatar_source_url" = case
            when "avatar" like 'http://%' or "avatar" like 'https://%' then "avatar"
            else null
          end,
          "avatar_storage_key" = case
            when "avatar" like 'http://%' or "avatar" like 'https://%' then null
            else "avatar"
          end;`,
    );
    this.addSql(
      'alter table "users" drop column if exists "avatar";',
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      'alter table "users" add column "avatar" varchar(255) null;',
    );
    this.addSql(
      `update "users"
        set "avatar" = coalesce("avatar_storage_key", "avatar_source_url");`,
    );
    this.addSql(
      `alter table "users"
        drop column if exists "avatar_source_type",
        drop column if exists "avatar_source_url",
        drop column if exists "avatar_storage_key";`,
    );
  }
}
