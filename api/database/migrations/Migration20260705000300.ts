import { Migration } from '@mikro-orm/migrations';

export class Migration20260705000300 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "user_oauth_accounts" (
        "id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "user_id" uuid not null,
        "provider" text check ("provider" in ('google', 'github')) not null,
        "provider_user_id" text not null,
        "email" text not null,
        constraint "user_oauth_accounts_pkey" primary key ("id")
      );`,
    );
    this.addSql(
      `alter table "user_oauth_accounts"
        add constraint "user_oauth_accounts_user_id_foreign"
        foreign key ("user_id")
        references "users" ("id")
        on update cascade
        on delete cascade;`,
    );
    this.addSql(
      'create unique index "user_oauth_accounts_provider_provider_user_id_unique" on "user_oauth_accounts" ("provider", "provider_user_id");',
    );
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists "user_oauth_accounts" cascade;');
  }
}
