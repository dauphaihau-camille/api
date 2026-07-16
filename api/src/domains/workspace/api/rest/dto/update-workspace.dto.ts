import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateWorkspaceDto {
  @ApiProperty({
    minimum: 1,
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({
    example: 'Camille Product',
    minLength: 2,
    maxLength: 80,
  })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({
    example: 'camille-product',
    minLength: 3,
    maxLength: 32,
    description: 'Custom workspace domain slug used in the app URL.',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  slug?: string;

  @ApiPropertyOptional({
    example: 'Shared docs and planning for the product team.',
    maxLength: 280,
  })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;
}
