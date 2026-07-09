import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { CurrentUserEntity } from '~/modules/domains/auth/infra/persistence/entities/current-user.entity';
import { AuditService } from '~/modules/shared/audit/audit.service';
import { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import { DocumentCommandRepository } from '../ports/document-command.repository';
import { DocumentNavigationQueryRepository } from '../ports/document-navigation-query.repository';
import { DocumentEntity } from '../../infra/persistence/entities/document.entity';
import { DEFAULT_CONTENT_FORMAT } from '../constants/document.constants';
import type { DocumentSummary } from '../contracts/document.contract';
import type { CreateDocumentInput } from '../contracts/document.input';
import { toDocumentSummary } from '../mappers/document-summary.mapper';
import { extractDocumentSearchText } from '../utils/document-search-text.util';
import { DocumentSubdocService } from '../services/document-subdoc.service';
import { DocumentTreeService } from '../services/document-tree.service';
import {
  DocumentNotFoundError,
  DocumentTeamspaceNotFoundError,
  ParentDocumentWorkspaceMismatchError,
} from '../errors/document-app.error';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';
import { normalizeContent } from '../utils/document-content.util';
import { normalizeTitle } from '../utils/document-title.util';

@Injectable()
export class CreateDocumentUseCase {
  constructor(
    private readonly auditService: AuditService,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly documentCommandRepository: DocumentCommandRepository,
    private readonly documentNavigationQueryRepository: DocumentNavigationQueryRepository,
    private readonly documentSubdocService: DocumentSubdocService,
    private readonly documentTreeService: DocumentTreeService,
  ) {}

  async execute(
    currentUser: AuthenticatedUser,
    input: CreateDocumentInput,
  ): Promise<DocumentSummary> {
    const workspace = await resolveWorkspaceForUser(this.workspaceRepository, input.workspaceId, currentUser);

    const parentDocument = input.parentDocumentId
      ? await this.documentNavigationQueryRepository.findDocument(input.parentDocumentId)
      : undefined;

    if (input.parentDocumentId && !parentDocument) {
      throw new DocumentNotFoundError(input.parentDocumentId);
    }

    const teamspaceId = parentDocument?.teamspace?.id ?? input.teamspaceId;
    const teamspace = teamspaceId
      ? await this.documentCommandRepository.findTeamspaceByIdInWorkspace(teamspaceId, workspace.id) as DocumentEntity['teamspace'] | null
      : undefined;

    if (teamspaceId && !teamspace) {
      throw new DocumentTeamspaceNotFoundError(teamspaceId);
    }

    if (parentDocument && parentDocument.workspace.id !== workspace.id) {
      throw new ParentDocumentWorkspaceMismatchError();
    }

    const normalizedContent = normalizeContent(input.content);

    const document = await this.documentCommandRepository.withTransaction(async ({
      commandRepository,
      subdocReferenceRepository,
    }) => {
      const user = await commandRepository.findCurrentUser(currentUser.userId) as CurrentUserEntity;

      const transactionalParentDocument = parentDocument?.id
        ? await commandRepository.findDocument(parentDocument.id)
        : null;

      const createdDocument = commandRepository.createDocument({
        workspace: workspace.id,
        teamspace: teamspace?.id,
        parentDocument: transactionalParentDocument?.id,
        title: normalizeTitle(input.title),
        contentFormat: input.contentFormat ?? DEFAULT_CONTENT_FORMAT,
        contentJson: normalizedContent,
        searchText: extractDocumentSearchText(normalizedContent),
        sortKey: await this.documentTreeService.resolveSortKeyForCreate(
          workspace.id,
          parentDocument?.id,
          teamspace?.id,
        ),
        createdBy: user,
        updatedBy: user,
      });

      await commandRepository.saveDocument(createdDocument);
      await this.documentSubdocService.syncSubdocReferencesForDoc(
        createdDocument,
        subdocReferenceRepository,
      );
      await commandRepository.flush();

      return createdDocument;
    });

    await this.auditService.record({
      action: 'document.created',
      resourceType: 'document',
      resourceId: document.id,
      metadata: {
        workspaceId: workspace.id,
        teamspaceId: teamspace?.id,
        parentDocumentId: parentDocument?.id,
      },
    });

    return toDocumentSummary(document);
  }
}
