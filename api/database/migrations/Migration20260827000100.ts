import { Migration } from '@mikro-orm/migrations';

export class Migration20260827000100 extends Migration {
  override async up(): Promise<void> {
    this.addSql('alter table "workspace_subscriptions" drop constraint if exists "workspace_subscriptions_plan_check";');
    this.addSql('alter table "workspace_subscriptions" add constraint "workspace_subscriptions_plan_check" check ("plan" in (\'free\', \'plus\', \'business\'));');

    this.addSql(`
      create table "ai_conversation_sessions" (
        "id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "version" int not null default 1,
        "workspace_id" uuid not null,
        "user_id" uuid not null,
        "title" text null,
        "last_activity_at" timestamptz not null,
        constraint "ai_conversation_sessions_pkey" primary key ("id")
      );
    `);
    this.addSql(`
      alter table "ai_conversation_sessions"
        add constraint "ai_conversation_sessions_workspace_id_foreign"
        foreign key ("workspace_id")
        references "workspaces" ("id")
        on update cascade
        on delete cascade;
    `);
    this.addSql(`
      alter table "ai_conversation_sessions"
        add constraint "ai_conversation_sessions_user_id_foreign"
        foreign key ("user_id")
        references "users" ("id")
        on update cascade
        on delete cascade;
    `);
    this.addSql('create index "ai_conversation_sessions_workspace_user_index" on "ai_conversation_sessions" ("workspace_id", "user_id");');
    this.addSql('create index "ai_conversation_sessions_last_activity_index" on "ai_conversation_sessions" ("last_activity_at");');

    this.addSql(`
      create table "ai_chat_turns" (
        "id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "version" int not null default 1,
        "session_id" uuid not null,
        "user_message" text not null,
        "assistant_response" text not null,
        "status" text not null,
        "metadata" jsonb not null default '{}',
        constraint "ai_chat_turns_pkey" primary key ("id"),
        constraint "ai_chat_turns_status_check" check ("status" in ('completed', 'failed', 'canceled'))
      );
    `);
    this.addSql(`
      alter table "ai_chat_turns"
        add constraint "ai_chat_turns_session_id_foreign"
        foreign key ("session_id")
        references "ai_conversation_sessions" ("id")
        on update cascade
        on delete cascade;
    `);
    this.addSql('create index "ai_chat_turns_session_id_index" on "ai_chat_turns" ("session_id", "created_at");');

    this.addSql(`
      create table "ai_chat_turn_document_attachments" (
        "id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "version" int not null default 1,
        "turn_id" uuid not null,
        "document_id" uuid not null,
        "title" text not null,
        constraint "ai_chat_turn_document_attachments_pkey" primary key ("id")
      );
    `);
    this.addSql(`
      alter table "ai_chat_turn_document_attachments"
        add constraint "ai_chat_turn_document_attachments_turn_id_foreign"
        foreign key ("turn_id")
        references "ai_chat_turns" ("id")
        on update cascade
        on delete cascade;
    `);
    this.addSql(`
      alter table "ai_chat_turn_document_attachments"
        add constraint "ai_chat_turn_document_attachments_document_id_foreign"
        foreign key ("document_id")
        references "documents" ("id")
        on update cascade
        on delete cascade;
    `);
    this.addSql('create index "ai_chat_turn_document_attachments_turn_index" on "ai_chat_turn_document_attachments" ("turn_id");');

    this.addSql(`
      create table "ai_response_reservations" (
        "id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "version" int not null default 1,
        "workspace_id" uuid not null,
        "status" text not null,
        "expires_at" timestamptz not null,
        constraint "ai_response_reservations_pkey" primary key ("id"),
        constraint "ai_response_reservations_status_check" check ("status" in ('reserved', 'consumed', 'released'))
      );
    `);
    this.addSql(`
      alter table "ai_response_reservations"
        add constraint "ai_response_reservations_workspace_id_foreign"
        foreign key ("workspace_id")
        references "workspaces" ("id")
        on update cascade
        on delete cascade;
    `);
    this.addSql('create index "ai_response_reservations_workspace_status_index" on "ai_response_reservations" ("workspace_id", "status", "expires_at");');
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists "ai_response_reservations" cascade;');
    this.addSql('drop table if exists "ai_chat_turn_document_attachments" cascade;');
    this.addSql('drop table if exists "ai_chat_turns" cascade;');
    this.addSql('drop table if exists "ai_conversation_sessions" cascade;');
    this.addSql('alter table "workspace_subscriptions" drop constraint if exists "workspace_subscriptions_plan_check";');
    this.addSql('alter table "workspace_subscriptions" add constraint "workspace_subscriptions_plan_check" check ("plan" in (\'free\', \'plus\'));');
  }
}
