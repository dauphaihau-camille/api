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

export class WorkspacePreferenceResponseDto {
  @ApiProperty()
  workspace_id!: string;

  @ApiProperty({
    type: () => WorkspaceNavigationPreferenceResponseDto,
  })
  navigation!: WorkspaceNavigationPreferenceResponseDto;

  static fromSummary(
    preference: WorkspacePreferenceSummary,
  ): WorkspacePreferenceResponseDto {
    return {
      workspace_id: preference.workspaceId,
      navigation: {
        expanded_document_ids: preference.navigation.expandedDocumentIds,
      },
    };
  }
}
