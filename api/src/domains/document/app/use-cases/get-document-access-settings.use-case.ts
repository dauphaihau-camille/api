import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { DocumentNotFoundError } from '../errors/document-app.error';
import type { DocumentAccessSettingSummary } from '../ports/document-access-setting.repository';
import { DocumentNavigationQueryRepository } from '../ports/document-navigation-query.repository';
import { DocumentAccessCapabilityService } from '../services/document-access-capability.service';

@Injectable()
export class GetDocumentAccessSettingsUseCase {
  constructor(
    private readonly documentNavigationQueryRepository: DocumentNavigationQueryRepository,
    private readonly documentAccessCapabilityService: DocumentAccessCapabilityService,
  ) {}

  async execute(
    documentId: string,
    currentUser: AuthenticatedUser,
  ): Promise<DocumentAccessSettingSummary | null> {
    const document = await this.documentNavigationQueryRepository.findDocument(documentId);
    if (!document) {
      throw new DocumentNotFoundError(documentId);
    }

    const { setting } = await this.documentAccessCapabilityService.assertCanManageAccess(document, currentUser);

    return setting;
  }
}
