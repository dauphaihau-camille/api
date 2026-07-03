import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { SearchDocumentSummary } from '../../../app/contracts/search.contract';

export class SearchDocumentResponseDto {
  @ApiProperty()
  document_id!: string;

  @ApiProperty()
  public_id!: string;

  @ApiProperty()
  workspace_id!: string;

  @ApiPropertyOptional()
  teamspace_id?: string;

  @ApiPropertyOptional()
  parent_document_id?: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  has_content!: boolean;

  @ApiProperty({
    type: [String],
  })
  breadcrumb_path!: string[];

  @ApiPropertyOptional()
  updated_by_name?: string;

  @ApiPropertyOptional()
  matched_text?: string;

  @ApiProperty()
  updated_at!: string;

  @ApiPropertyOptional()
  visited_at?: string;

  static fromSummary(summary: SearchDocumentSummary): SearchDocumentResponseDto {
    return {
      document_id: summary.documentId,
      public_id: summary.publicId,
      workspace_id: summary.workspaceId,
      teamspace_id: summary.teamspaceId,
      parent_document_id: summary.parentDocumentId,
      title: summary.title,
      has_content: summary.hasContent,
      breadcrumb_path: summary.breadcrumbPath,
      updated_by_name: summary.updatedByName,
      matched_text: summary.matchedText,
      updated_at: summary.updatedAt.toISOString(),
      visited_at: summary.visitedAt?.toISOString(),
    };
  }
}
