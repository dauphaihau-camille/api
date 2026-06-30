import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class MoveDocumentDto {
  @ApiProperty({
    minimum: 1,
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({
    example: '95d9f7cb-7057-4c7a-bfde-c25ae7975f15',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  teamspace_id?: string | null;

  @ApiPropertyOptional({
    example: '66cf61ad-e395-4f91-8af9-15d309c347f2',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  parent_document_id?: string | null;

  @ApiPropertyOptional({
    minimum: 0,
    example: 0,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  index?: number;
}
