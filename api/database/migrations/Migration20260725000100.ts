import { Migration } from '@mikro-orm/migrations';

export class Migration20260725000100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "workspace_user_preferences"
        add column "expanded_document_ids_by_scope" jsonb not null default '{}';
    `);
    this.addSql(`
      update "workspace_user_preferences"
      set "expanded_document_ids_by_scope" = jsonb_build_object(
        'private',
        coalesce("expanded_document_ids", '[]'::jsonb)
      );
    `);
    this.addSql(`
      alter table "workspace_user_preferences"
        drop column "expanded_document_ids";
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table "workspace_user_preferences"
        add column "expanded_document_ids" jsonb not null default '[]';
    `);
    this.addSql(`
      update "workspace_user_preferences"
      set "expanded_document_ids" = coalesce(
        "expanded_document_ids_by_scope" -> 'private',
        '[]'::jsonb
      );
    `);
    this.addSql(`
      alter table "workspace_user_preferences"
        drop column "expanded_document_ids_by_scope";
    `);
  }
}
