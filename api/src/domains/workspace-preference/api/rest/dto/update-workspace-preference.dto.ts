import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsObject, ValidateNested,
} from 'class-validator';

class WorkspaceNavigationPreferenceDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
  })
  @IsObject()
  expanded_document_ids_by_scope!: Record<string, string[]>;
}

export class UpdateWorkspacePreferenceDto {
  @ApiProperty({
    type: () => WorkspaceNavigationPreferenceDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => WorkspaceNavigationPreferenceDto)
  navigation!: WorkspaceNavigationPreferenceDto;
}
