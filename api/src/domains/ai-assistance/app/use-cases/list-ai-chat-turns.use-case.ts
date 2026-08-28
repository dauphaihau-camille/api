import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { WorkspaceRepository } from '~/domains/workspace/app/ports/workspace.repository';
import type { AiChatTurnListResult } from '../contracts/ai-assistance.contract';
import { AiConversationSessionNotFoundError, AiWorkspaceNotFoundError } from '../errors/ai-assistance-app.error';
import { AiConversationRepository } from '../ports/ai-conversation.repository';

@Injectable()
export class ListAiChatTurnsUseCase {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly aiConversationRepository: AiConversationRepository,
  ) {}

  async execute(
    currentUser: AuthenticatedUser,
    input: {
      workspaceId: string;
      sessionId: string;
      limit: number;
      cursor?: string;
    },
  ): Promise<AiChatTurnListResult> {
    const access = await this.workspaceRepository.findWorkspaceAccess(
      input.workspaceId,
      currentUser.userId,
    );

    if (!access) {
      throw new AiWorkspaceNotFoundError();
    }

    const session = await this.aiConversationRepository.findSession({
      sessionId: input.sessionId,
      workspaceId: input.workspaceId,
      userId: currentUser.userId,
    });

    if (!session) {
      throw new AiConversationSessionNotFoundError();
    }

    return this.aiConversationRepository.listTurns({
      sessionId: input.sessionId,
      workspaceId: input.workspaceId,
      userId: currentUser.userId,
      limit: input.limit,
      cursor: input.cursor,
    });
  }
}
