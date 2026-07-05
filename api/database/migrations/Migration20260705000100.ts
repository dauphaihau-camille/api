import { Migration } from '@mikro-orm/migrations';

export class Migration20260705000100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "documents"
      add column "public_access_override" text null;
    `);

    this.addSql(`
      alter table "documents"
      add constraint "documents_public_access_override_check"
      check ("public_access_override" in ('unpublished') or "public_access_override" is null);
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table "documents"
      drop constraint "documents_public_access_override_check";
    `);

    this.addSql(`
      alter table "documents"
      drop column "public_access_override";
    `);
  }
}
