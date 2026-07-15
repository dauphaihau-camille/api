import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  PublicDocumentSummary,
  PublishedDocumentSummary,
} from '../../../app/publish.types';

export class PublishedDocumentResponseDto {
  @ApiProperty()
  document_id!: string;

  @ApiPropertyOptional()
  published_document_id?: string;

  @ApiPropertyOptional()
  public_path?: string;

  @ApiPropertyOptional()
  published_at?: string;

  static fromSummary(summary: PublishedDocumentSummary): PublishedDocumentResponseDto {
    return {
      document_id: summary.documentId,
      published_document_id: summary.publishedDocumentId,
      public_path: summary.publicPath,
      published_at: summary.publishedAt?.toISOString(),
    };
  }
}

export class PublicDocumentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  published_document_id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  content_format!: string;

  @ApiProperty({
    type: 'array',
    items: {},
  })
  content!: unknown[];

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        published_document_id: { type: 'string' },
        public_path: { type: 'string' },
      },
    },
  })
  breadcrumb!: Array<{
    id: string;
    title: string;
    published_document_id: string;
    public_path: string;
  }>;

  @ApiProperty()
  published_at!: string;

  @ApiProperty()
  updated_at!: string;

  static fromSummary(summary: PublicDocumentSummary): PublicDocumentResponseDto {
    return {
      id: summary.id,
      published_document_id: summary.publishedDocumentId,
      title: summary.title,
      content_format: summary.contentFormat,
      content: summary.content,
      breadcrumb: summary.breadcrumb.map((item) => ({
        id: item.id,
        title: item.title,
        published_document_id: item.publishedDocumentId,
        public_path: item.publicPath,
      })),
      published_at: summary.publishedAt.toISOString(),
      updated_at: summary.updatedAt.toISOString(),
    };
  }
}
