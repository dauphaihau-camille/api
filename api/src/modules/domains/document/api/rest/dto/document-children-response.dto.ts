import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { DocumentTreeChild } from '../../../app/document.types';

export class DocumentTreeChildResponseDto {
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

  static fromNode(node: DocumentTreeChild): DocumentTreeChildResponseDto {
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
