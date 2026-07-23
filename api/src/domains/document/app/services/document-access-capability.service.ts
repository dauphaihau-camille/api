import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import type { WorkspaceSummary } from '~/domains/workspace/app/contracts/workspace.contract';
import { WorkspaceRepository } from '~/domains/workspace/app/ports/workspace.repository';
import type { DocumentEntity } from '../../infra/persistence/entities/document.entity';
import { DocumentPermissionDeniedError } from '../errors/document-app.error';
import {
  DocumentAccessSettingRepository,
  type DocumentAccessSettingSummary,
} from '../ports/document-access-setting.repository';
import { DocumentAccessGrantRepository } from '../ports/document-access-grant.repository';
import {
  DocumentAccessResolver,
  type DocumentCapabilities,
} from '../policies/document-access.resolver';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';

export type ResolvedDocumentAccess = {
  capabilities: DocumentCapabilities;
  setting: DocumentAccessSettingSummary | null;
  workspace: WorkspaceSummary;
};

@Injectable()
export class DocumentAccessCapabilityService {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly documentAccessGrantRepository: DocumentAccessGrantRepository,
    private readonly documentAccessSettingRepository: DocumentAccessSettingRepository,
    private readonly documentAccessResolver: DocumentAccessResolver,
  ) {}

  async resolveForDocument(
    document: DocumentEntity,
    currentUser: AuthenticatedUser,
  ): Promise<ResolvedDocumentAccess> {
    const workspace = await resolveWorkspaceForUser(this.workspaceRepository, document.workspace.id, currentUser);

    const [actorGrant, hasActiveGrants, setting] = await Promise.all([
      this.documentAccessGrantRepository.findActiveGrant({
        documentId: document.id,
        userId: currentUser.userId,
      }),
      this.documentAccessGrantRepository.hasActiveGrants(document.id),
      this.documentAccessSettingRepository.findByDocumentId(document.id),
    ]);

    const capabilities = this.documentAccessResolver.resolve({
      actorUserId: currentUser.userId,
      documentOwnerUserId: document.ownerUser.id,
      documentTeamspaceId: document.teamspace?.id,
      documentHasActiveGrants: hasActiveGrants,
      directGrantPermission: actorGrant?.permission,
      workspaceMemberPermission: setting?.workspaceMemberPermission,
      workspaceRole: workspace.currentUserRole,
    });

    return {
      capabilities,
      setting,
      workspace,
    };
  }

  async assertCanManageAccess(
    document: DocumentEntity,
    currentUser: AuthenticatedUser,
  ): Promise<ResolvedDocumentAccess> {
    const resolvedAccess = await this.resolveForDocument(document, currentUser);

    if (!resolvedAccess.capabilities.canManageAccess) {
      throw new DocumentPermissionDeniedError();
    }

    return resolvedAccess;
  }

  async assertCanView(
    document: DocumentEntity,
    currentUser: AuthenticatedUser,
  ): Promise<ResolvedDocumentAccess> {
    const resolvedAccess = await this.resolveForDocument(document, currentUser);

    if (!resolvedAccess.capabilities.canView) {
      throw new DocumentPermissionDeniedError();
    }

    return resolvedAccess;
  }

  async assertCanEdit(
    document: DocumentEntity,
    currentUser: AuthenticatedUser,
  ): Promise<ResolvedDocumentAccess> {
    const resolvedAccess = await this.resolveForDocument(document, currentUser);

    if (!resolvedAccess.capabilities.canEdit) {
      throw new DocumentPermissionDeniedError();
    }

    return resolvedAccess;
  }
}
