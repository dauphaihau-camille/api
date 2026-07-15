import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import { DocumentNavigationQueryRepository } from '../ports/document-navigation-query.repository';
import { DocumentTreeQueryRepository } from '../ports/document-tree-query.repository';
import { DocumentVisitRepository } from '../ports/document-visit.repository';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';

@Injectable()
export class GetDefaultWorkspaceDocumentUseCase {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly documentNavigationQueryRepository: DocumentNavigationQueryRepository,
    private readonly documentVisitRepository: DocumentVisitRepository,
    private readonly documentTreeQueryRepository: DocumentTreeQueryRepository,
  ) {}

  async execute(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
    recentDocumentId?: string,
  ): Promise<{ documentId?: string }> {
    const workspace = await resolveWorkspaceForUser(this.workspaceRepository, workspaceIdentifier, currentUser);

    if (recentDocumentId) {
      const recentDocument = await this.documentNavigationQueryRepository.findDocumentByIdInWorkspace({
        documentId: recentDocumentId,
        workspaceId: workspace.id,
        archivedAt: null,
      });

      if (recentDocument) {
        return { documentId: recentDocument.id };
      }
    }

    const recentVisit = await this.documentVisitRepository.findRecentVisit({
      workspaceId: workspace.id,
      userId: currentUser.userId,
    });

    if (recentVisit?.document) {
      return { documentId: recentVisit.document.id };
    }

    const firstPrivateRoot = await this.documentTreeQueryRepository.findFirstSibling({
      workspaceId: workspace.id,
      parentDocumentId: null,
      teamspaceId: null,
    });

    if (firstPrivateRoot) {
      return { documentId: firstPrivateRoot.id };
    }

    const teamspaces = await this.documentNavigationQueryRepository.findTeamspaces(workspace.id);

    for (const teamspace of teamspaces) {
      const firstTeamspaceRoot = await this.documentTreeQueryRepository.findFirstSibling({
        workspaceId: workspace.id,
        parentDocumentId: null,
        teamspaceId: teamspace.id,
      });

      if (firstTeamspaceRoot) {
        return { documentId: firstTeamspaceRoot.id };
      }
    }

    return {};
  }
}
