import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { WorkspaceSummary } from '../../../app/contracts/workspace.contract';
import { WorkspaceRole } from '../../../domain/enums/workspace-role.enum';

export class WorkspaceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({
    enum: WorkspaceRole,
  })
  current_user_role!: WorkspaceRole;

  @ApiProperty()
  created_at!: string;

  @ApiProperty()
  updated_at!: string;

  static fromWorkspace(workspace: WorkspaceSummary): WorkspaceResponseDto {
    return {
      id: workspace.id,
      version: workspace.version,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      current_user_role: workspace.currentUserRole,
      created_at: workspace.createdAt.toISOString(),
      updated_at: workspace.updatedAt.toISOString(),
    };
  }
}
