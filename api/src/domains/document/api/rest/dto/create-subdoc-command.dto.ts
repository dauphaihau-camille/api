import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateSubdocCommandDto {
  @ApiPropertyOptional({
    example: '2111b7ab-2f34-401b-8a6c-1f2c0665a0ed',
  })
  @IsOptional()
  @IsString()
  anchor_block_id?: string;

  @ApiPropertyOptional({
    example: '/doc',
  })
  @IsOptional()
  @IsString()
  slash_command_text?: string;

  @ApiPropertyOptional({
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @ApiPropertyOptional({
    type: 'array',
    items: {},
  })
  @IsOptional()
  @IsArray()
  content?: unknown[];
}
