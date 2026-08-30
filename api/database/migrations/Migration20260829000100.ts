import { Migration } from '@mikro-orm/migrations';

export class Migration20260829000100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "ai_chat_turns" add column "response_block_payload" jsonb not null default '[]';`);
    this.addSql(`
      update "ai_chat_turns"
      set "response_block_payload" = jsonb_build_array(
        jsonb_build_object(
          'id', 'ai-block-1',
          'type', 'paragraph',
          'content', jsonb_build_array(
            jsonb_build_object('type', 'text', 'text', "assistant_response")
          )
        )
      )
      where length(trim("assistant_response")) > 0
        and "response_block_payload" = '[]'::jsonb;
    `);
  }

  override async down(): Promise<void> {
    this.addSql('alter table "ai_chat_turns" drop column if exists "response_block_payload";');
  }
}
