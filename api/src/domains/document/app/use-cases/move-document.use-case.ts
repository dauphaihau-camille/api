import { OptimisticLockError } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { AuditService } from '~/integrations/audit/audit.service';
import { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import type { DocumentSummary } from '../contracts/document.contract';
import type { MoveDocumentInput } from '../contracts/document.input';
import { DocumentCommandRepository } from '../ports/document-command.repository';
import { DocumentNavigationQueryRepository } from '../ports/document-navigation-query.repository';
import {
  DocumentDescendantMoveError,
  DocumentNotFoundError,
  DocumentTeamspaceNotFoundError,
  DocumentVersionConflictError,
  MoveParentDocumentWorkspaceMismatchError,
} from '../errors/document-app.error';
import { toDocumentSummary } from '../mappers/document-summary.mapper';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';
import { DocumentTreeService } from '../services/document-tree.service';
import { DocumentAccessCapabilityService } from '../services/document-access-capability.service';

@Injectable()
export class MoveDocumentUseCase {
  constructor(
    private readonly auditService: AuditService,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly documentAccessCapabilityService: DocumentAccessCapabilityService,
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
    await this.documentAccessCapabilityService.assertCanEdit(document, currentUser);

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

    const nextTeamspaceReference = nextTeamspaceId
      ? { id: nextTeamspaceId } as typeof document.teamspace
      : undefined;
    document.parentDocument = nextParent ?? undefined;
    document.teamspace = nextTeamspaceReference;
    document.sortKey = await this.documentTreeService.resolveSortKeyForMove(
      document.id,
      workspace.id,
      nextParent?.id,
      nextTeamspace?.id,
      input.index,
    );
    this.documentCommandRepository.assignUpdatedByUser(document, currentUser.userId);

    const descendants = await this.documentTreeService.findDescendants(document.id, workspace.id);
    for (const descendant of descendants) {
      descendant.teamspace = nextTeamspaceReference;
      this.documentCommandRepository.assignUpdatedByUser(descendant, currentUser.userId);
    }

    await this.documentCommandRepository.saveDocuments([document, ...descendants]);

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
