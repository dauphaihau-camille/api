import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { WorkspaceRepository } from '~/domains/workspace/app/ports/workspace.repository';
import type { AiResponseEntitlementSummary } from '../contracts/ai-assistance.contract';
import { AiWorkspaceNotFoundError } from '../errors/ai-assistance-app.error';
import { AiResponseGateService } from '../services/ai-response-gate.service';

@Injectable()
export class GetAiResponseEntitlementUseCase {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly aiResponseGateService: AiResponseGateService,
  ) {}

  async execute(
    currentUser: AuthenticatedUser,
    input: { workspaceId: string },
  ): Promise<AiResponseEntitlementSummary> {
    const access = await this.workspaceRepository.findWorkspaceAccess(
      input.workspaceId,
      currentUser.userId,
    );

    if (!access) {
      throw new AiWorkspaceNotFoundError();
    }

    return this.aiResponseGateService.getEntitlementSummary(input.workspaceId);
  }
}
