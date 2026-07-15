import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';
import { WorkspaceRole } from '~/domains/workspace/domain/enums/workspace-role.enum';

export class UpdateWorkspaceMemberDto {
  @ApiProperty({
    minimum: 1,
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @ApiProperty({
    enum: WorkspaceRole,
    example: WorkspaceRole.ADMIN,
  })
  @IsEnum(WorkspaceRole)
  role!: WorkspaceRole;
}
