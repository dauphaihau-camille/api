import {
  Collection,
  Entity,
  OneToMany,
  Property,
  Unique,
} from '@mikro-orm/core';
import { AbstractWorkspaceEntity } from './abstract-workspace.entity';
import { WorkspaceMemberEntity } from './workspace-member.entity';

@Entity({ tableName: 'workspaces' })
export class WorkspaceEntity extends AbstractWorkspaceEntity {
  @Property({ fieldName: 'version', version: true })
  version = 1;

  @Property({ fieldName: 'name' })
  name!: string;

  @Property({ fieldName: 'slug' })
  @Unique()
  slug!: string;

  @Property({ fieldName: 'description', nullable: true })
  description?: string;

  @OneToMany(() => WorkspaceMemberEntity, (membership) => membership.workspace)
  memberships = new Collection<WorkspaceMemberEntity>(this);
}
