import { Migration } from '@mikro-orm/migrations';

export class Migration20260702000100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create or replace function "documents_extract_search_text"("content" jsonb)
      returns text
      language sql
      immutable
      as $$
        select trim(
          regexp_replace(
            coalesce(string_agg(value #>> '{}', ' '), ''),
            '\\s+',
            ' ',
            'g'
          )
        )
        from jsonb_path_query("content", '$.**.text') as value;
      $$;
    `);

    this.addSql(`
      alter table "documents"
        add column "search_text" text not null default '';
    `);

    this.addSql(`
      update "documents"
      set "search_text" = "documents_extract_search_text"("content_json");
    `);

    this.addSql(`
      alter table "documents"
        add column "search_vector" tsvector generated always as (
          setweight(to_tsvector('simple', coalesce("title", '')), 'A')
          ||
          setweight(to_tsvector('simple', coalesce("search_text", '')), 'B')
        ) stored;
    `);

    this.addSql(`
      create index "documents_search_vector_index"
      on "documents"
      using gin ("search_vector")
      where "archived_at" is null;
    `);
  }

  override async down(): Promise<void> {
    this.addSql('drop index if exists "documents_search_vector_index";');
    this.addSql('alter table "documents" drop column if exists "search_vector";');
    this.addSql('alter table "documents" drop column if exists "search_text";');
    this.addSql('drop function if exists "documents_extract_search_text"(jsonb);');
  }
}
