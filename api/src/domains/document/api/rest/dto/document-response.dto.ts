import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  DocumentAccessSummary,
  DocumentBreadcrumbItem,
  DocumentSummary,
} from '../../../app/contracts/document.contract';

class DocumentAccessResponseDto {
  @ApiProperty()
  scope!: string;

  @ApiProperty()
  permission!: string;

  @ApiProperty()
  can_view!: boolean;

  @ApiProperty()
  can_edit!: boolean;

  @ApiProperty()
  can_manage!: boolean;

  @ApiPropertyOptional()
  workspace_member_permission?: string;

  static fromSummary(access: DocumentAccessSummary): DocumentAccessResponseDto {
    return {
      scope: access.scope,
      permission: access.permission,
      can_view: access.canView,
      can_edit: access.canEdit,
      can_manage: access.canManage,
      workspace_member_permission: access.workspaceMemberPermission,
    };
  }
}

class DocumentCollaborationResponseDto {
  @ApiProperty()
  enabled!: boolean;

  @ApiProperty()
  mode!: string;

  @ApiProperty()
  show_presence!: boolean;
}

class DocumentOwnerUserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional()
  display_name?: string;
}

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

  @ApiProperty({
    type: DocumentOwnerUserResponseDto,
  })
  owner_user!: DocumentOwnerUserResponseDto;

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

  @ApiPropertyOptional({
    type: DocumentAccessResponseDto,
  })
  access?: DocumentAccessResponseDto;

  @ApiPropertyOptional({
    type: DocumentCollaborationResponseDto,
  })
  collaboration?: DocumentCollaborationResponseDto;

  static fromSummary(document: DocumentSummary): DocumentResponseDto {
    return {
      id: document.id,
      public_id: document.publicId,
      version: document.version,
      workspace_id: document.workspaceId,
      owner_user_id: document.ownerUserId,
      owner_user: {
        id: document.ownerUser.id,
        email: document.ownerUser.email,
        display_name: document.ownerUser.displayName,
      },
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
      access: document.access
        ? DocumentAccessResponseDto.fromSummary(document.access)
        : undefined,
      collaboration: document.collaboration
        ? {
          enabled: document.collaboration.enabled,
          mode: document.collaboration.mode,
          show_presence: document.collaboration.showPresence,
        }
        : undefined,
    };
  }
}
