import {
  Collection, Entity, Enum, ManyToOne, OneToMany, Opt, Property,
} from '@mikro-orm/core';
import { WorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/workspace.entity';
import { AbstractWorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/abstract-workspace.entity';
import { DocumentEntity } from '~/domains/document/infra/persistence/entities/document.entity';
import { TeamspaceAccessMode } from '../../../domain/enums/teamspace-access-mode.enum';
import { TeamspaceMemberEntity } from './teamspace-member.entity';

@Entity({ tableName: 'teamspaces' })
export class TeamspaceEntity extends AbstractWorkspaceEntity {
  @Property({ fieldName: 'version', version: true })
  version = 1;

  @ManyToOne(() => WorkspaceEntity, { fieldName: 'workspace_id' })
  workspace!: WorkspaceEntity;

  @Property({ fieldName: 'name' })
  name!: string;

  @Property({ fieldName: 'description', nullable: true })
  description?: string;

  @Enum({ items: () => TeamspaceAccessMode, fieldName: 'access_mode' })
  accessMode: Opt<TeamspaceAccessMode> = TeamspaceAccessMode.OPEN;

  @OneToMany(() => DocumentEntity, (document) => document.teamspace)
  documents = new Collection<DocumentEntity>(this);

  @OneToMany(() => TeamspaceMemberEntity, (member) => member.teamspace)
  members = new Collection<TeamspaceMemberEntity>(this);
}
