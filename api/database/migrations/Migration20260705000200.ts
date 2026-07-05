import { Migration } from '@mikro-orm/migrations';

export class Migration20260705000200 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "email_login_challenges" (
        "id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "email" text not null,
        "code_hash" text not null,
        "expires_at" timestamptz not null,
        "consumed_at" timestamptz null,
        constraint "email_login_challenges_pkey" primary key ("id")
      );`,
    );
    this.addSql(
      'create index "email_login_challenges_email_index" on "email_login_challenges" ("email");',
    );
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists "email_login_challenges" cascade;');
  }
}
