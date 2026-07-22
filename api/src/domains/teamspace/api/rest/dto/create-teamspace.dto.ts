import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional, IsString, MaxLength, MinLength, 
} from 'class-validator';
import { TeamspaceAccessMode } from '../../../domain/enums/teamspace-access-mode.enum';

export class CreateTeamspaceDto {
  @ApiProperty({
    example: 'Product',
    minLength: 2,
    maxLength: 80,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({
    example: 'Shared product documents and specs.',
    maxLength: 280,
  })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @ApiPropertyOptional({ enum: TeamspaceAccessMode, default: TeamspaceAccessMode.OPEN })
  @IsOptional()
  @IsEnum(TeamspaceAccessMode)
  access_mode?: TeamspaceAccessMode;
}
