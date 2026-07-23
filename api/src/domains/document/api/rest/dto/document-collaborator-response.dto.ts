import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentAccessGrantPermission } from '../../../domain/enums/document-access-grant-permission.enum';
import type {
  DocumentAccessGrantSummary,
} from '../../../app/ports/document-access-grant.repository';
import type { DocumentCollaboratorSummary } from '../../../app/use-cases/list-document-collaborators.use-case';
import type {
  ShareDocumentFailureSummary,
  ShareDocumentsSummary,
} from '../../../app/use-cases/share-document.use-case';

export class DocumentCollaboratorUserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional()
  display_name?: string;
}

export class DocumentCollaboratorResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  document_id!: string;

  @ApiProperty({
    type: DocumentCollaboratorUserResponseDto,
  })
  user!: DocumentCollaboratorUserResponseDto;

  @ApiProperty({
    enum: DocumentAccessGrantPermission,
  })
  permission!: DocumentAccessGrantPermission;

  @ApiProperty()
  granted_by_user_id!: string;

  @ApiProperty()
  created_at!: string;

  @ApiProperty()
  updated_at!: string;

  @ApiProperty({
    enum: ['direct', 'inherited'],
  })
  access_source!: 'direct' | 'inherited';

  @ApiPropertyOptional()
  inherited_from_document_id?: string;

  @ApiPropertyOptional()
  inherited_from_document_title?: string;

  static fromSummary(
    grant: DocumentAccessGrantSummary | DocumentCollaboratorSummary,
  ): DocumentCollaboratorResponseDto {
    const accessSource = 'accessSource' in grant ? grant.accessSource : 'direct';

    const inheritedFromDocument = 'inheritedFromDocument' in grant
      ? grant.inheritedFromDocument
      : undefined;

    return {
      id: grant.id,
      document_id: grant.documentId,
      user: {
        id: grant.user.id,
        email: grant.user.email,
        display_name: grant.user.displayName,
      },
      permission: grant.permission,
      granted_by_user_id: grant.grantedByUserId,
      created_at: grant.createdAt.toISOString(),
      updated_at: grant.updatedAt.toISOString(),
      access_source: accessSource,
      inherited_from_document_id: inheritedFromDocument?.id,
      inherited_from_document_title: inheritedFromDocument?.title,
    };
  }
}

export class ShareDocumentFailureResponseDto {
  @ApiProperty()
  user_id!: string;

  @ApiProperty({
    enum: ['workspace_user_not_found'],
  })
  reason!: ShareDocumentFailureSummary['reason'];

  static fromSummary(failure: ShareDocumentFailureSummary): ShareDocumentFailureResponseDto {
    return {
      user_id: failure.userId,
      reason: failure.reason,
    };
  }
}

export class ShareDocumentsResponseDto {
  @ApiProperty({
    type: DocumentCollaboratorResponseDto,
    isArray: true,
  })
  collaborators!: DocumentCollaboratorResponseDto[];

  @ApiProperty({
    type: ShareDocumentFailureResponseDto,
    isArray: true,
  })
  failed!: ShareDocumentFailureResponseDto[];

  static fromSummary(summary: ShareDocumentsSummary): ShareDocumentsResponseDto {
    return {
      collaborators: summary.collaborators.map(DocumentCollaboratorResponseDto.fromSummary),
      failed: summary.failed.map(ShareDocumentFailureResponseDto.fromSummary),
    };
  }
}
