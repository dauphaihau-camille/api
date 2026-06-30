import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateDocumentDto {
  @ApiProperty({
    minimum: 1,
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({
    example: 'Roadmap',
    maxLength: 180,
  })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  title?: string;

  @ApiPropertyOptional({
    example: 'blocknote_v1',
  })
  @IsOptional()
  @IsString()
  content_format?: 'blocknote_v1';

  @ApiPropertyOptional({
    type: 'array',
    items: {},
  })
  @IsOptional()
  @IsArray()
  content?: unknown[];
}
