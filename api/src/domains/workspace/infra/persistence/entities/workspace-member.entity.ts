import {
  Entity,
  Enum,
  ManyToOne,
  Property,
  Unique,
} from '@mikro-orm/core';
import { UserEntity } from '../../../../user/infra/persistence/entities/user.entity';
import { WorkspaceRole } from '../../../domain/enums/workspace-role.enum';
import { AbstractWorkspaceEntity } from './abstract-workspace.entity';
import { WorkspaceEntity } from './workspace.entity';

@Entity({ tableName: 'workspace_members' })
@Unique({ properties: ['workspace', 'user'] })
export class WorkspaceMemberEntity extends AbstractWorkspaceEntity {
  @Property({ fieldName: 'version', version: true })
  version = 1;

  @ManyToOne(() => WorkspaceEntity, { fieldName: 'workspace_id' })
  workspace!: WorkspaceEntity;

  @ManyToOne(() => UserEntity, { fieldName: 'user_id' })
  user!: UserEntity;

  @Enum({ items: () => WorkspaceRole, fieldName: 'role' })
  role!: WorkspaceRole;

  @Property({ fieldName: 'joined_at' })
  joinedAt = new Date();
}
