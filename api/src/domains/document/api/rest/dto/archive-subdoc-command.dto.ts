import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class ArchiveSubdocCommandDto {
  @ApiProperty({
    example: '2111b7ab-2f34-401b-8a6c-1f2c0665a0ed',
  })
  @IsString()
  subdocument_id!: string;

  @ApiProperty({
    example: 1,
  })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiProperty({
    type: 'array',
    items: {},
    required: false,
  })
  @IsOptional()
  @IsArray()
  content?: unknown[];
}
