import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { DocumentSummary } from '../../../app/document.types';

export class DocumentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  public_id!: string;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  workspace_id!: string;

  @ApiPropertyOptional()
  teamspace_id?: string;

  @ApiPropertyOptional()
  parent_document_id?: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  content_format!: string;

  @ApiProperty({
    type: 'array',
    items: {},
  })
  content!: unknown[];

  @ApiProperty()
  sort_key!: number;

  @ApiPropertyOptional()
  archived_at?: string;

  @ApiProperty()
  created_at!: string;

  @ApiProperty()
  updated_at!: string;

  static fromSummary(document: DocumentSummary): DocumentResponseDto {
    return {
      id: document.id,
      public_id: document.publicId,
      version: document.version,
      workspace_id: document.workspaceId,
      teamspace_id: document.teamspaceId,
      parent_document_id: document.parentDocumentId,
      title: document.title,
      content_format: document.contentFormat,
      content: document.content,
      sort_key: document.sortKey,
      archived_at: document.archivedAt?.toISOString(),
      created_at: document.createdAt.toISOString(),
      updated_at: document.updatedAt.toISOString(),
    };
  }
}
