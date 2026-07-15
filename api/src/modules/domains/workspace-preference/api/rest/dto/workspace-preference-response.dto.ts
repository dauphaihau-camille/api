import { ApiProperty } from '@nestjs/swagger';
import type { WorkspacePreferenceSummary } from '../../../app/workspace-preference.types';

class WorkspaceNavigationPreferenceResponseDto {
  @ApiProperty({
    type: 'array',
    items: {
      type: 'string',
    },
  })
  expanded_document_ids!: string[];
}

class WorkspaceActivityPreferenceResponseDto {
  @ApiProperty({
    nullable: true,
    type: String,
  })
  last_active_at!: string | null;
}

export class WorkspacePreferenceResponseDto {
  @ApiProperty()
  workspace_id!: string;

  @ApiProperty({
    type: () => WorkspaceNavigationPreferenceResponseDto,
  })
  navigation!: WorkspaceNavigationPreferenceResponseDto;

  @ApiProperty({
    type: () => WorkspaceActivityPreferenceResponseDto,
  })
  activity!: WorkspaceActivityPreferenceResponseDto;

  static fromSummary(
    preference: WorkspacePreferenceSummary,
  ): WorkspacePreferenceResponseDto {
    return {
      workspace_id: preference.workspaceId,
      navigation: {
        expanded_document_ids: preference.navigation.expandedDocumentIds,
      },
      activity: {
        last_active_at: preference.activity.lastActiveAt?.toISOString() ?? null,
      },
    };
  }
}
