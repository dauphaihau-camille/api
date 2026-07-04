import {
  Collection, Entity, ManyToOne, OneToMany, Property, 
} from '@mikro-orm/core';
import { WorkspaceEntity } from '~/modules/domains/workspace/infra/persistence/entities/workspace.entity';
import { AbstractWorkspaceEntity } from '~/modules/domains/workspace/infra/persistence/entities/abstract-workspace.entity';
import { DocumentEntity } from '~/modules/domains/document/infra/persistence/entities/document.entity';

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

  @OneToMany(() => DocumentEntity, (document) => document.teamspace)
  documents = new Collection<DocumentEntity>(this);
}
