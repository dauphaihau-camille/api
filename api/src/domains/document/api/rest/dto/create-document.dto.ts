import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray, IsOptional, IsString, MaxLength, 
} from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty({
    example: 'camille-product',
  })
  @IsString()
  workspace_id!: string;

  @ApiPropertyOptional({
    example: '95d9f7cb-7057-4c7a-bfde-c25ae7975f15',
  })
  @IsOptional()
  @IsString()
  teamspace_id?: string;

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
