import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateWorkspaceDto {
  @ApiProperty({
    example: 'Camille Product',
    minLength: 2,
    maxLength: 80,
  })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({
    example: 'camille-product',
    minLength: 3,
    maxLength: 32,
    description: 'Custom workspace slug used in workspace URLs.',
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
