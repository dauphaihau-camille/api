import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  ArchivedDocumentListItem,
  ArchivedDocumentListPage,
} from '../../../app/contracts/document.contract';

export class ArchivedDocumentListItemResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  public_id!: string;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  has_content!: boolean;

  @ApiProperty({
    type: [String],
  })
  breadcrumb_path!: string[];

  @ApiProperty()
  archived_at!: string;

  static fromItem(item: ArchivedDocumentListItem): ArchivedDocumentListItemResponseDto {
    return {
      id: item.id,
      public_id: item.publicId,
      version: item.version,
      title: item.title,
      has_content: item.hasContent,
      breadcrumb_path: item.breadcrumbPath,
      archived_at: item.archivedAt.toISOString(),
    };
  }
}

export class ArchivedDocumentListPageResponseDto {
  @ApiProperty({
    type: () => ArchivedDocumentListItemResponseDto,
    isArray: true,
  })
  items!: ArchivedDocumentListItemResponseDto[];

  @ApiPropertyOptional()
  next_cursor?: string;

  static fromPage(page: ArchivedDocumentListPage): ArchivedDocumentListPageResponseDto {
    return {
      items: page.items.map(ArchivedDocumentListItemResponseDto.fromItem),
      next_cursor: page.nextCursor,
    };
  }
}
