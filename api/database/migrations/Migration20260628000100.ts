import { Migration } from '@mikro-orm/migrations';

export class Migration20260628000100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "audit_logs" (
        "id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "occurred_at" timestamptz not null,
        "action" varchar(255) not null,
        "resource_type" varchar(255) not null,
        "resource_id" varchar(255) null,
        "status" varchar(255) not null,
        "actor_id" varchar(255) null,
        "actor_email" varchar(255) null,
        "request_id" varchar(255) null,
        "ip_address" varchar(255) null,
        "user_agent" varchar(255) null,
        "metadata" jsonb null,
        constraint "audit_logs_pkey" primary key ("id")
      );`,
    );
    this.addSql(
      `create index "audit_logs_action_occurred_at_index"
        on "audit_logs" ("action", "occurred_at");`,
    );
    this.addSql(
      `create index "audit_logs_resource_type_resource_id_index"
        on "audit_logs" ("resource_type", "resource_id");`,
    );
    this.addSql(
      `create index "audit_logs_actor_id_occurred_at_index"
        on "audit_logs" ("actor_id", "occurred_at");`,
    );
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists "audit_logs" cascade;');
  }
}
