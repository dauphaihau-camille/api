import { Migration } from '@mikro-orm/migrations';

export class Migration20260702000200 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create or replace function "documents_extract_search_text"("content" jsonb)
      returns text
      language sql
      immutable
      as $$
        with recursive nodes(value) as (
          select "content"

          union all

          select child.value
          from nodes
          cross join lateral (
            select jsonb_array_elements(nodes.value) as value
            where jsonb_typeof(nodes.value) = 'array'

            union all

            select nested.value
            from jsonb_each(nodes.value) as nested(key, value)
            where
              jsonb_typeof(nodes.value) = 'object'
              and nested.key in ('content', 'children')
          ) as child
        )
        select trim(
          regexp_replace(
            coalesce(string_agg(nodes.value ->> 'text', ' '), ''),
            '\\s+',
            ' ',
            'g'
          )
        )
        from nodes
        where jsonb_typeof(nodes.value) = 'object' and nodes.value ? 'text';
      $$;
    `);

    this.addSql(`
      update "documents"
      set "search_text" = "documents_extract_search_text"("content_json");
    `);
  }

  override async down(): Promise<void> {
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
      update "documents"
      set "search_text" = "documents_extract_search_text"("content_json");
    `);
  }
}
