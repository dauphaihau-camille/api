import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { DocumentAccessSettingSummary } from '../../../app/ports/document-access-setting.repository';

export class DocumentAccessSettingsResponseDto {
  @ApiProperty()
  document_id!: string;

  @ApiPropertyOptional()
  workspace_member_permission?: string;

  @ApiProperty()
  updated_by_user_id!: string;

  @ApiProperty()
  created_at!: string;

  @ApiProperty()
  updated_at!: string;

  static fromSummary(
    setting: DocumentAccessSettingSummary | null,
    documentId?: string,
  ): DocumentAccessSettingsResponseDto {
    if (!setting) {
      const now = new Date(0).toISOString();

      return {
        document_id: documentId ?? '',
        workspace_member_permission: undefined,
        updated_by_user_id: '',
        created_at: now,
        updated_at: now,
      };
    }

    return {
      document_id: setting.documentId,
      workspace_member_permission: setting.workspaceMemberPermission,
      updated_by_user_id: setting.updatedByUserId,
      created_at: setting.createdAt.toISOString(),
      updated_at: setting.updatedAt.toISOString(),
    };
  }
}
