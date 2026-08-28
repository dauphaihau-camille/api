import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { DocumentModule } from '~/domains/document/document.module';
import { SubscriptionModule } from '~/domains/subscription/subscription.module';
import { WorkspaceModule } from '~/domains/workspace/workspace.module';
import { AiModule } from '~/integrations/ai/ai.module';
import { AiAssistanceController } from './api/rest/ai-assistance.controller';
import { AiConversationRepository } from './app/ports/ai-conversation.repository';
import { AiResponseGateService } from './app/services/ai-response-gate.service';
import { CreateAiChatTurnUseCase } from './app/use-cases/create-ai-chat-turn.use-case';
import { GetAiResponseEntitlementUseCase } from './app/use-cases/get-ai-response-entitlement.use-case';
import { ListAiChatTurnsUseCase } from './app/use-cases/list-ai-chat-turns.use-case';
import {
  CreateAiConversationSessionUseCase,
  ListAiConversationSessionsUseCase,
} from './app/use-cases/session.use-cases';
import { MikroOrmAiConversationRepository } from './infra/mikro-orm-ai-conversation.repository';
import { AiChatTurnEntity } from './infra/persistence/entities/ai-chat-turn.entity';
import { AiConversationSessionEntity } from './infra/persistence/entities/ai-conversation-session.entity';
import { AiDocumentAttachmentEntity } from './infra/persistence/entities/ai-document-attachment.entity';
import { AiResponseReservationEntity } from './infra/persistence/entities/ai-response-reservation.entity';

@Module({
  imports: [
    WorkspaceModule,
    DocumentModule,
    SubscriptionModule,
    AiModule,
    MikroOrmModule.forFeature([
      AiConversationSessionEntity,
      AiChatTurnEntity,
      AiDocumentAttachmentEntity,
      AiResponseReservationEntity,
    ]),
  ],
  controllers: [AiAssistanceController],
  providers: [
    {
      provide: AiConversationRepository,
      useClass: MikroOrmAiConversationRepository,
    },
    AiResponseGateService,
    GetAiResponseEntitlementUseCase,
    ListAiConversationSessionsUseCase,
    CreateAiConversationSessionUseCase,
    ListAiChatTurnsUseCase,
    CreateAiChatTurnUseCase,
  ],
})
export class AiAssistanceModule {}
