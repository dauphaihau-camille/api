import { ApiProperty } from '@nestjs/swagger';
import type { WorkspaceSummary } from '../../../app/workspace.types';

export class WorkspaceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  static fromWorkspace(workspace: WorkspaceSummary): WorkspaceResponseDto {
    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
    };
  }
}
