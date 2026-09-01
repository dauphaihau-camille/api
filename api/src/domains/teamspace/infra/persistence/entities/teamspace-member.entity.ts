import {
  Entity,
  Enum,
  ManyToOne,
  Property,
  Unique,
} from '@mikro-orm/core';
import { UserEntity } from '../../../../user/infra/persistence/entities/user.entity';
import { AbstractWorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/abstract-workspace.entity';
import { TeamspaceMemberRole } from '../../../domain/enums/teamspace-member-role.enum';
import { TeamspaceEntity } from './teamspace.entity';

@Entity({ tableName: 'teamspace_members' })
@Unique({ properties: ['teamspace', 'user'] })
export class TeamspaceMemberEntity extends AbstractWorkspaceEntity {
  @Property({ fieldName: 'version', version: true })
  version = 1;

  @ManyToOne(() => TeamspaceEntity, { fieldName: 'teamspace_id' })
  teamspace!: TeamspaceEntity;

  @ManyToOne(() => UserEntity, { fieldName: 'user_id' })
  user!: UserEntity;

  @Enum({ items: () => TeamspaceMemberRole, fieldName: 'role' })
  role!: TeamspaceMemberRole;
}
