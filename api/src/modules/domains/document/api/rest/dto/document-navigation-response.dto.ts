import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  DocumentNavigationNode,
  DocumentNavigationPage,
  TeamspaceDocumentNavigationGroup,
  WorkspaceDocumentNavigation,
} from '../../../app/document.types';

export class DocumentNavigationNodeResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  public_id!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  teamspace_id?: string;

  @ApiPropertyOptional()
  parent_document_id?: string;

  @ApiProperty()
  sort_key!: number;

  @ApiProperty()
  has_children!: boolean;

  @ApiProperty()
  has_content!: boolean;

  static fromNode(node: DocumentNavigationNode): DocumentNavigationNodeResponseDto {
    return {
      id: node.id,
      public_id: node.publicId,
      title: node.title,
      teamspace_id: node.teamspaceId,
      parent_document_id: node.parentDocumentId,
      sort_key: node.sortKey,
      has_children: node.hasChildren,
      has_content: node.hasContent,
    };
  }
}

export class DocumentNavigationPageResponseDto {
  @ApiProperty({
    type: () => DocumentNavigationNodeResponseDto,
    isArray: true,
  })
  items!: DocumentNavigationNodeResponseDto[];

  @ApiPropertyOptional()
  next_cursor?: string;

  static fromPage(page: DocumentNavigationPage): DocumentNavigationPageResponseDto {
    return {
      items: page.items.map(DocumentNavigationNodeResponseDto.fromNode),
      next_cursor: page.nextCursor,
    };
  }
}

export class TeamspaceDocumentNavigationGroupResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({
    type: () => DocumentNavigationPageResponseDto,
  })
  documents!: DocumentNavigationPageResponseDto;

  static fromGroup(group: TeamspaceDocumentNavigationGroup): TeamspaceDocumentNavigationGroupResponseDto {
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      documents: DocumentNavigationPageResponseDto.fromPage(group.documents),
    };
  }
}

export class WorkspaceDocumentNavigationResponseDto {
  @ApiProperty({
    type: () => DocumentNavigationPageResponseDto,
  })
  private_documents!: DocumentNavigationPageResponseDto;

  @ApiProperty({
    type: () => TeamspaceDocumentNavigationGroupResponseDto,
    isArray: true,
  })
  teamspaces!: TeamspaceDocumentNavigationGroupResponseDto[];

  static fromNavigation(
    navigation: WorkspaceDocumentNavigation,
  ): WorkspaceDocumentNavigationResponseDto {
    return {
      private_documents: DocumentNavigationPageResponseDto.fromPage(navigation.privateDocuments),
      teamspaces: navigation.teamspaces.map(TeamspaceDocumentNavigationGroupResponseDto.fromGroup),
    };
  }
}
