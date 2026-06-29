import { Migration } from '@mikro-orm/migrations';

export class Migration20260629000100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "workspaces" (
        "id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "version" int not null default 1,
        "name" varchar(255) not null,
        "slug" varchar(255) not null,
        "description" varchar(255) null,
        constraint "workspaces_pkey" primary key ("id")
      );`,
    );
    this.addSql(
      'alter table "workspaces" add constraint "workspaces_slug_unique" unique ("slug");',
    );
    this.addSql(
      `create table "workspace_members" (
        "id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "version" int not null default 1,
        "workspace_id" uuid not null,
        "user_id" uuid not null,
        "role" varchar(255) not null,
        "joined_at" timestamptz not null,
        constraint "workspace_members_pkey" primary key ("id")
      );`,
    );
    this.addSql(
      `alter table "workspace_members"
        add constraint "workspace_members_workspace_id_user_id_unique"
        unique ("workspace_id", "user_id");`,
    );
    this.addSql(
      `alter table "workspace_members"
        add constraint "workspace_members_workspace_id_foreign"
        foreign key ("workspace_id")
        references "workspaces" ("id")
        on update cascade
        on delete cascade;`,
    );
    this.addSql(
      `alter table "workspace_members"
        add constraint "workspace_members_user_id_foreign"
        foreign key ("user_id")
        references "users" ("id")
        on update cascade
        on delete cascade;`,
    );
    this.addSql(
      'create index "workspace_members_workspace_id_index" on "workspace_members" ("workspace_id");',
    );
    this.addSql(
      'create index "workspace_members_user_id_index" on "workspace_members" ("user_id");',
    );
    this.addSql(
      'create index "workspace_members_role_index" on "workspace_members" ("role");',
    );
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists "workspace_members" cascade;');
    this.addSql('drop table if exists "workspaces" cascade;');
  }
}
