import { Migration } from '@mikro-orm/migrations';

export class Migration20260721000100 extends Migration {
  override async up(): Promise<void> {
    this.addSql('alter table "documents" add column "owner_user_id" uuid null;');
    this.addSql('update "documents" set "owner_user_id" = "created_by" where "owner_user_id" is null;');
    this.addSql('alter table "documents" alter column "owner_user_id" set not null;');
    this.addSql(`
      alter table "documents"
        add constraint "documents_owner_user_id_foreign"
        foreign key ("owner_user_id")
        references "users" ("id")
        on update cascade
        on delete restrict;
    `);
    this.addSql('create index "documents_owner_user_id_index" on "documents" ("owner_user_id");');
  }

  override async down(): Promise<void> {
    this.addSql('alter table "documents" drop constraint if exists "documents_owner_user_id_foreign";');
    this.addSql('drop index if exists "documents_owner_user_id_index";');
    this.addSql('alter table "documents" drop column if exists "owner_user_id";');
  }
}
