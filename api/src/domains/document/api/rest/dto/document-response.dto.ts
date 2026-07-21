import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  DocumentBreadcrumbItem,
  DocumentSummary,
} from '../../../app/contracts/document.contract';

class DocumentBreadcrumbItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  public_id!: string;

  @ApiProperty()
  title!: string;

  static fromSummary(item: DocumentBreadcrumbItem): DocumentBreadcrumbItemDto {
    return {
      id: item.id,
      public_id: item.publicId,
      title: item.title,
    };
  }
}

export class DocumentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  public_id!: string;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  workspace_id!: string;

  @ApiProperty()
  owner_user_id!: string;

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

  @ApiPropertyOptional()
  archived_by_name?: string;

  @ApiProperty()
  created_at!: string;

  @ApiProperty()
  updated_at!: string;

  @ApiPropertyOptional()
  is_favorite?: boolean;

  @ApiPropertyOptional()
  published_document_id?: string;

  @ApiPropertyOptional()
  public_path?: string;

  @ApiPropertyOptional({
    type: DocumentBreadcrumbItemDto,
    isArray: true,
  })
  breadcrumb?: DocumentBreadcrumbItemDto[];

  static fromSummary(document: DocumentSummary): DocumentResponseDto {
    return {
      id: document.id,
      public_id: document.publicId,
      version: document.version,
      workspace_id: document.workspaceId,
      owner_user_id: document.ownerUserId,
      teamspace_id: document.teamspaceId,
      parent_document_id: document.parentDocumentId,
      title: document.title,
      content_format: document.contentFormat,
      content: document.content,
      sort_key: document.sortKey,
      archived_at: document.archivedAt?.toISOString(),
      archived_by_name: document.archivedByName,
      created_at: document.createdAt.toISOString(),
      updated_at: document.updatedAt.toISOString(),
      is_favorite: document.isFavorite,
      published_document_id: document.publishedDocumentId,
      public_path: document.publicPath,
      breadcrumb: document.breadcrumb?.map(DocumentBreadcrumbItemDto.fromSummary),
    };
  }
}
