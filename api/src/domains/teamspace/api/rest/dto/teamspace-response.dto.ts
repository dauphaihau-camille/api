import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TeamspaceAccessMode } from '../../../domain/enums/teamspace-access-mode.enum';
import type { TeamspaceSummary } from '../../../app/teamspace.types';

export class TeamspaceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  workspace_id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ enum: TeamspaceAccessMode })
  access_mode!: TeamspaceAccessMode;

  @ApiProperty()
  created_at!: string;

  @ApiProperty()
  updated_at!: string;

  static fromSummary(teamspace: TeamspaceSummary): TeamspaceResponseDto {
    return {
      id: teamspace.id,
      version: teamspace.version,
      workspace_id: teamspace.workspaceId,
      name: teamspace.name,
      description: teamspace.description,
      access_mode: teamspace.accessMode,
      created_at: teamspace.createdAt.toISOString(),
      updated_at: teamspace.updatedAt.toISOString(),
    };
  }
}
