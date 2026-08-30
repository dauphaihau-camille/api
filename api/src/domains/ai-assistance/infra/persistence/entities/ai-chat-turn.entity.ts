import {
  Entity,
  Enum,
  ManyToOne,
  Property,
} from '@mikro-orm/core';
import { AbstractWorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/abstract-workspace.entity';
import { AiConversationSessionEntity } from './ai-conversation-session.entity';
import type {
  AiChatTurnStatus,
  AiResponseBlockPayload,
} from '../../../app/contracts/ai-assistance.contract';

@Entity({ tableName: 'ai_chat_turns' })
export class AiChatTurnEntity extends AbstractWorkspaceEntity {
  @Property({ fieldName: 'version', version: true })
  version = 1;

  @ManyToOne(() => AiConversationSessionEntity, { fieldName: 'session_id' })
  session!: AiConversationSessionEntity;

  @Property({ fieldName: 'user_message', type: 'text' })
  userMessage!: string;

  @Property({ fieldName: 'assistant_response', type: 'text' })
  assistantResponse!: string;

  @Property({ fieldName: 'response_block_payload', type: 'json' })
  responseBlockPayload: AiResponseBlockPayload = [];

  @Enum({ fieldName: 'status', items: ['completed', 'failed', 'canceled'] })
  status: AiChatTurnStatus = 'completed';

  @Property({ fieldName: 'metadata', type: 'json' })
  metadata: Record<string, unknown> = {};
}
