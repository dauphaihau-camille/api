import { Migration } from '@mikro-orm/migrations';

export class Migration20260823000100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table "workspace_subscriptions" (
        "id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "version" int not null default 1,
        "workspace_id" uuid not null,
        "plan" text not null,
        "status" text not null,
        "seat_count" int not null,
        "current_period_start" timestamptz null,
        "current_period_end" timestamptz null,
        "cancel_at_period_end" boolean not null default false,
        "provider" text null,
        "provider_customer_id" text null,
        "provider_subscription_id" text null,
        "provider_price_id" text null,
        "provider_status" text null,
        constraint "workspace_subscriptions_pkey" primary key ("id"),
        constraint "workspace_subscriptions_plan_check" check ("plan" in ('free', 'plus')),
        constraint "workspace_subscriptions_status_check" check ("status" in ('free', 'active', 'past_due', 'canceling'))
      );
    `);
    this.addSql(`
      alter table "workspace_subscriptions"
        add constraint "workspace_subscriptions_workspace_id_foreign"
        foreign key ("workspace_id")
        references "workspaces" ("id")
        on update cascade
        on delete cascade;
    `);
    this.addSql('create unique index "workspace_subscriptions_workspace_id_unique" on "workspace_subscriptions" ("workspace_id");');
    this.addSql('create unique index "workspace_subscriptions_provider_subscription_id_unique" on "workspace_subscriptions" ("provider_subscription_id") where "provider_subscription_id" is not null;');
    this.addSql('create index "workspace_subscriptions_status_index" on "workspace_subscriptions" ("status");');
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists "workspace_subscriptions" cascade;');
  }
}
