import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
      created_at: teamspace.createdAt.toISOString(),
      updated_at: teamspace.updatedAt.toISOString(),
    };
  }
}
