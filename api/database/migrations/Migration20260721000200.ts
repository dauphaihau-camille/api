import { Migration } from '@mikro-orm/migrations';

export class Migration20260721000200 extends Migration {
  override async up(): Promise<void> {
    this.addSql('alter table "teamspaces" add column "access_mode" text not null default \'open\';');

    this.addSql(`
      alter table "teamspaces"
        add constraint "teamspaces_access_mode_check"
        check ("access_mode" in ('open', 'restricted'));
    `);

    this.addSql(`
      create table "teamspace_members" (
        "id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "version" int not null default 1,
        "teamspace_id" uuid not null,
        "user_id" uuid not null,
        "role" text not null,
        constraint "teamspace_members_pkey" primary key ("id")
      );
    `);
    this.addSql(`
      alter table "teamspace_members"
        add constraint "teamspace_members_role_check"
        check ("role" in ('viewer', 'editor', 'manager'));
    `);
    this.addSql(`
      alter table "teamspace_members"
        add constraint "teamspace_members_teamspace_id_foreign"
        foreign key ("teamspace_id")
        references "teamspaces" ("id")
        on update cascade
        on delete cascade;
    `);
    this.addSql(`
      alter table "teamspace_members"
        add constraint "teamspace_members_user_id_foreign"
        foreign key ("user_id")
        references "users" ("id")
        on update cascade
        on delete cascade;
    `);
    this.addSql('create unique index "teamspace_members_teamspace_id_user_id_unique" on "teamspace_members" ("teamspace_id", "user_id");');
    this.addSql('create index "teamspace_members_teamspace_id_index" on "teamspace_members" ("teamspace_id");');
    this.addSql('create index "teamspace_members_user_id_index" on "teamspace_members" ("user_id");');
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists "teamspace_members" cascade;');
    this.addSql('alter table "teamspaces" drop constraint if exists "teamspaces_access_mode_check";');
    this.addSql('alter table "teamspaces" drop column if exists "access_mode";');
  }
}
