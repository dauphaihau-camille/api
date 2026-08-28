import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { WorkspaceRepository } from '~/domains/workspace/app/ports/workspace.repository';
import { buildPaginationMeta } from '~/platform/application/pagination';
import type {
  AiConversationSessionListResult,
  AiConversationSessionSummary,
} from '../contracts/ai-assistance.contract';
import { AiWorkspaceNotFoundError } from '../errors/ai-assistance-app.error';
import { AiConversationRepository } from '../ports/ai-conversation.repository';

@Injectable()
export class ListAiConversationSessionsUseCase {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly aiConversationRepository: AiConversationRepository,
  ) {}

  async execute(
    currentUser: AuthenticatedUser,
    input: {
      workspaceId: string; page: number; limit: number; q?: string 
    },
  ): Promise<AiConversationSessionListResult> {
    const access = await this.workspaceRepository.findWorkspaceAccess(
      input.workspaceId,
      currentUser.userId,
    );

    if (!access) {
      throw new AiWorkspaceNotFoundError();
    }

    const result = await this.aiConversationRepository.listSessions({
      workspaceId: input.workspaceId,
      userId: currentUser.userId,
      page: input.page,
      limit: input.limit,
      q: input.q,
    });
    return {
      items: result.items,
      meta: buildPaginationMeta(input.page, input.limit, result.total),
    };
  }
}

@Injectable()
export class CreateAiConversationSessionUseCase {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly aiConversationRepository: AiConversationRepository,
  ) {}

  async execute(
    currentUser: AuthenticatedUser,
    input: { workspaceId: string },
  ): Promise<AiConversationSessionSummary> {
    const access = await this.workspaceRepository.findWorkspaceAccess(
      input.workspaceId,
      currentUser.userId,
    );

    if (!access) {
      throw new AiWorkspaceNotFoundError();
    }

    return this.aiConversationRepository.createSession({
      workspaceId: input.workspaceId,
      userId: currentUser.userId,
    });
  }
}
