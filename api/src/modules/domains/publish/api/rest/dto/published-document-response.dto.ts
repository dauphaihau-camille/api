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
  title!: string;

  @ApiProperty()
  content_format!: string;

  @ApiProperty({
    type: 'array',
    items: {},
  })
  content!: unknown[];

  @ApiProperty()
  published_at!: string;

  @ApiProperty()
  updated_at!: string;

  static fromSummary(summary: PublicDocumentSummary): PublicDocumentResponseDto {
    return {
      id: summary.id,
      title: summary.title,
      content_format: summary.contentFormat,
      content: summary.content,
      published_at: summary.publishedAt.toISOString(),
      updated_at: summary.updatedAt.toISOString(),
    };
  }
}
