import { OptimisticLockError } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { AuditService } from '~/integrations/audit/audit.service';
import { canEditWorkspace } from '../../../workspace/app/workspace-permissions';
import { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import type { DocumentSummary } from '../contracts/document.contract';
import type { MoveDocumentInput } from '../contracts/document.input';
import { DocumentCommandRepository } from '../ports/document-command.repository';
import { DocumentNavigationQueryRepository } from '../ports/document-navigation-query.repository';
import {
  DocumentDescendantMoveError,
  DocumentNotFoundError,
  DocumentPermissionDeniedError,
  DocumentTeamspaceNotFoundError,
  DocumentVersionConflictError,
  MoveParentDocumentWorkspaceMismatchError,
} from '../errors/document-app.error';
import { toDocumentSummary } from '../mappers/document-summary.mapper';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';
import { DocumentTreeService } from '../services/document-tree.service';

@Injectable()
export class MoveDocumentUseCase {
  constructor(
    private readonly auditService: AuditService,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly documentCommandRepository: DocumentCommandRepository,
    private readonly documentNavigationQueryRepository: DocumentNavigationQueryRepository,
    private readonly documentTreeService: DocumentTreeService,
  ) {}

  async execute(
    documentId: string,
    currentUser: AuthenticatedUser,
    input: MoveDocumentInput,
  ): Promise<DocumentSummary> {
    const document = await this.documentCommandRepository.findDocument(documentId);
    if (!document) {
      throw new DocumentNotFoundError(documentId);
    }
    const workspace = await resolveWorkspaceForUser(this.workspaceRepository, document.workspace.id, currentUser);
    if (!canEditWorkspace(workspace.currentUserRole)) {
      throw new DocumentPermissionDeniedError();
    }

    try {
      await this.documentCommandRepository.lockDocumentVersion(document, input.version);
    }
    catch (error) {
      if (error instanceof OptimisticLockError) {
        throw new DocumentVersionConflictError();
      }

      throw error;
    }

    const nextParent = input.parentDocumentId
      ? await this.documentNavigationQueryRepository.findDocument(input.parentDocumentId)
      : undefined;

    if (input.parentDocumentId && !nextParent) {
      throw new DocumentNotFoundError(input.parentDocumentId);
    }

    if (nextParent && nextParent.workspace.id !== workspace.id) {
      throw new MoveParentDocumentWorkspaceMismatchError();
    }

    if (nextParent && await this.documentTreeService.isDescendantOf(nextParent.id, document.id, document.workspace.id)) {
      throw new DocumentDescendantMoveError();
    }

    const nextTeamspaceId = nextParent?.teamspace?.id ??
      (input.teamspaceId === undefined ? document.teamspace?.id : input.teamspaceId ?? undefined);
    const nextTeamspace = nextTeamspaceId
      ? await this.documentCommandRepository.findTeamspaceByIdInWorkspace(nextTeamspaceId, workspace.id)
      : undefined;

    if (nextTeamspaceId && !nextTeamspace) {
      throw new DocumentTeamspaceNotFoundError(nextTeamspaceId);
    }

    document.parentDocument = nextParent ?? undefined;
    document.teamspace = nextTeamspaceId ? { id: nextTeamspaceId } as typeof document.teamspace : undefined;
    document.sortKey = await this.documentTreeService.resolveSortKeyForMove(
      document.id,
      workspace.id,
      nextParent?.id,
      nextTeamspace?.id,
      input.index,
    );
    this.documentCommandRepository.assignUpdatedByUser(document, currentUser.userId);

    await this.documentCommandRepository.saveDocument(document);

    await this.auditService.record({
      action: 'document.moved',
      resourceType: 'document',
      resourceId: document.id,
      metadata: {
        workspaceId: workspace.id,
        parentDocumentId: nextParent?.id,
        teamspaceId: nextTeamspace?.id,
      },
    });

    return toDocumentSummary(document);
  }
}
