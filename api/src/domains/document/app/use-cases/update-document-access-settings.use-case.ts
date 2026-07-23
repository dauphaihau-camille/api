import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { DocumentAccessGrantPermission } from '../../domain/enums/document-access-grant-permission.enum';
import { DocumentNotFoundError } from '../errors/document-app.error';
import {
  DocumentAccessSettingRepository,
  type DocumentAccessSettingSummary,
} from '../ports/document-access-setting.repository';
import { DocumentCommandRepository } from '../ports/document-command.repository';
import { DocumentAccessCapabilityService } from '../services/document-access-capability.service';

@Injectable()
export class UpdateDocumentAccessSettingsUseCase {
  constructor(
    private readonly documentCommandRepository: DocumentCommandRepository,
    private readonly documentAccessSettingRepository: DocumentAccessSettingRepository,
    private readonly documentAccessCapabilityService: DocumentAccessCapabilityService,
  ) {}

  async execute(
    documentId: string,
    currentUser: AuthenticatedUser,
    input: {
      workspaceMemberPermission?: DocumentAccessGrantPermission;
    },
  ): Promise<DocumentAccessSettingSummary> {
    const document = await this.documentCommandRepository.findDocument(documentId);
    if (!document) {
      throw new DocumentNotFoundError(documentId);
    }

    const { workspace } = await this.documentAccessCapabilityService.assertCanManageAccess(document, currentUser);

    return this.documentAccessSettingRepository.upsertWorkspaceMemberPermission({
      workspaceId: workspace.id,
      documentId: document.id,
      permission: input.workspaceMemberPermission,
      updatedByUserId: currentUser.userId,
    });
  }
}
