import {
  Entity,
  Enum,
  ManyToOne,
  Property,
  Unique,
} from '@mikro-orm/core';
import { CurrentUserEntity } from '~/modules/domains/auth/infra/persistence/entities/current-user.entity';
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

  @ManyToOne(() => CurrentUserEntity, { fieldName: 'user_id' })
  user!: CurrentUserEntity;

  @Enum({ items: () => WorkspaceRole, fieldName: 'role' })
  role!: WorkspaceRole;

  @Property({ fieldName: 'joined_at' })
  joinedAt = new Date();
}
