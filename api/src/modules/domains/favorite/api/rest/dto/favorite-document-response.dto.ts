import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { FavoriteDocumentSummary } from '../../../app/contracts/favorite.contract';

export class FavoriteDocumentResponseDto {
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
  sort_key!: number;

  @ApiProperty()
  favorited_at!: string;

  static fromSummary(summary: FavoriteDocumentSummary): FavoriteDocumentResponseDto {
    return {
      document_id: summary.documentId,
      public_id: summary.publicId,
      workspace_id: summary.workspaceId,
      teamspace_id: summary.teamspaceId,
      parent_document_id: summary.parentDocumentId,
      title: summary.title,
      sort_key: summary.sortKey,
      favorited_at: summary.favoritedAt.toISOString(),
    };
  }
}
