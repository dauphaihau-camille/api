import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray, IsObject, IsString, ValidateNested, 
} from 'class-validator';

class WorkspaceNavigationPreferenceDto {
  @ApiProperty({
    type: 'array',
    items: {
      type: 'string',
    },
  })
  @IsArray()
  @IsString({ each: true })
  expanded_document_ids!: string[];
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
