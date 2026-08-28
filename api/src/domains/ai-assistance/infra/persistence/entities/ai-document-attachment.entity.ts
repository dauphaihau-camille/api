import { Entity, ManyToOne, Property } from '@mikro-orm/core';
import { DocumentEntity } from '~/domains/document/infra/persistence/entities/document.entity';
import { AbstractWorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/abstract-workspace.entity';
import { AiChatTurnEntity } from './ai-chat-turn.entity';

@Entity({ tableName: 'ai_chat_turn_document_attachments' })
export class AiDocumentAttachmentEntity extends AbstractWorkspaceEntity {
  @Property({ fieldName: 'version', version: true })
  version = 1;

  @ManyToOne(() => AiChatTurnEntity, { fieldName: 'turn_id' })
  turn!: AiChatTurnEntity;

  @ManyToOne(() => DocumentEntity, { fieldName: 'document_id' })
  document!: DocumentEntity;

  @Property({ fieldName: 'title' })
  title!: string;
}
