import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  DOCUMENT_LIST_DEFAULT_LIMIT,
  DOCUMENT_LIST_MAX_LIMIT,
} from '../../../app/document.types';

export class ListWorkspaceDocumentsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parent_document_id?: string;

  @ApiPropertyOptional({
    default: DOCUMENT_LIST_DEFAULT_LIMIT,
    minimum: 1,
    maximum: DOCUMENT_LIST_MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(DOCUMENT_LIST_MAX_LIMIT)
  limit: number = DOCUMENT_LIST_DEFAULT_LIMIT;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;
}
