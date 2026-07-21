import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { AuditService } from '~/integrations/audit/audit.service';
import { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import { DocumentCommandRepository } from '../ports/document-command.repository';
import { DEFAULT_CONTENT_FORMAT } from '../constants/document.constants';
import type { DocumentSummary } from '../contracts/document.contract';
import type { CreateDocumentInput } from '../contracts/document.input';
import { toDocumentSummary } from '../mappers/document-summary.mapper';
import { extractDocumentSearchText } from '../utils/document-search-text.util';
import { DocumentTreeService } from '../services/document-tree.service';
import { DocumentTeamspaceNotFoundError } from '../errors/document-app.error';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';
import { normalizeContent } from '../utils/document-content.util';
import { normalizeTitle } from '../utils/document-title.util';
import { SyncDocumentSubdocReferencesUseCase } from './sync-document-subdoc-references.use-case';

@Injectable()
export class CreateDocumentUseCase {
  constructor(
    private readonly auditService: AuditService,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly documentCommandRepository: DocumentCommandRepository,
    private readonly syncDocumentSubdocReferencesUseCase: SyncDocumentSubdocReferencesUseCase,
    private readonly documentTreeService: DocumentTreeService,
  ) {}

  async execute(
    currentUser: AuthenticatedUser,
    input: CreateDocumentInput,
  ): Promise<DocumentSummary> {
    const workspace = await resolveWorkspaceForUser(this.workspaceRepository, input.workspaceId, currentUser);
    const teamspaceId = input.teamspaceId;
    const teamspace = teamspaceId
      ? await this.documentCommandRepository.findTeamspaceByIdInWorkspace(teamspaceId, workspace.id)
      : undefined;

    if (teamspaceId && !teamspace) {
      throw new DocumentTeamspaceNotFoundError(teamspaceId);
    }

    const normalizedContent = normalizeContent(input.content);

    const document = await this.documentCommandRepository.withTransaction(async ({
      commandRepository,
      subdocReferenceRepository,
    }) => {
      const createdDocument = commandRepository.createDocument({
        workspaceId: workspace.id,
        teamspaceId: teamspace?.id,
        title: normalizeTitle(input.title),
        contentFormat: input.contentFormat ?? DEFAULT_CONTENT_FORMAT,
        contentJson: normalizedContent,
        searchText: extractDocumentSearchText(normalizedContent),
        sortKey: await this.documentTreeService.resolveSortKeyForCreate(
          workspace.id,
          undefined,
          teamspace?.id,
        ),
        createdByUserId: currentUser.userId,
        ownerUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      });

      await commandRepository.saveDocument(createdDocument);
      await this.syncDocumentSubdocReferencesUseCase.execute(
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
      },
    });

    return toDocumentSummary(document);
  }
}
