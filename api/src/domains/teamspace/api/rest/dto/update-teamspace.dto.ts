import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TeamspaceAccessMode } from '../../../domain/enums/teamspace-access-mode.enum';

export class UpdateTeamspaceDto {
  @ApiProperty({
    minimum: 1,
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({
    example: 'Product',
    minLength: 2,
    maxLength: 80,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({
    example: 'Shared product documents and specs.',
    maxLength: 280,
  })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @ApiPropertyOptional({ enum: TeamspaceAccessMode })
  @IsOptional()
  @IsEnum(TeamspaceAccessMode)
  access_mode?: TeamspaceAccessMode;
}
