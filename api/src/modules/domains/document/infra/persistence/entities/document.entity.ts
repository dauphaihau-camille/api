import {
  Entity,
  ManyToOne,
  Opt,
  Property,
  Unique,
} from '@mikro-orm/core';
import { randomBytes } from 'node:crypto';
import { CurrentUserEntity } from '~/modules/domains/auth/infra/persistence/entities/current-user.entity';
import { TeamspaceEntity } from '~/modules/domains/teamspace/infra/persistence/entities/teamspace.entity';
import { WorkspaceEntity } from '~/modules/domains/workspace/infra/persistence/entities/workspace.entity';
import { AbstractWorkspaceEntity } from '~/modules/domains/workspace/infra/persistence/entities/abstract-workspace.entity';

@Entity({ tableName: 'documents' })
@Unique({ properties: ['publicId'] })
export class DocumentEntity extends AbstractWorkspaceEntity {
  @Property({ fieldName: 'version', version: true })
  version = 1;

  @ManyToOne(() => WorkspaceEntity, { fieldName: 'workspace_id' })
  workspace!: WorkspaceEntity;

  @ManyToOne(() => TeamspaceEntity, { fieldName: 'teamspace_id', nullable: true })
  teamspace?: TeamspaceEntity;

  @ManyToOne(() => DocumentEntity, { fieldName: 'parent_document_id', nullable: true })
  parentDocument?: DocumentEntity;

  @Property({ fieldName: 'public_id' })
  publicId: Opt<string> = randomBytes(16).toString('hex');

  @Property({ fieldName: 'title' })
  title!: string;

  @Property({ fieldName: 'content_format' })
  contentFormat!: string;

  @Property({ fieldName: 'content_json', type: 'json' })
  contentJson!: unknown[];

  @Property({ fieldName: 'search_text' })
  searchText = '';

  @Property({ fieldName: 'sort_key' })
  sortKey = 0;

  @Property({ fieldName: 'archived_at', nullable: true })
  archivedAt?: Date;

  @ManyToOne(() => CurrentUserEntity, { fieldName: 'created_by' })
  createdBy!: CurrentUserEntity;

  @ManyToOne(() => CurrentUserEntity, { fieldName: 'updated_by' })
  updatedBy!: CurrentUserEntity;
}
