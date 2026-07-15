import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { WorkspaceRole } from '~/domains/workspace/domain/enums/workspace-role.enum';

export class AddWorkspaceMemberDto {
  @ApiProperty({
    example: 'member@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({
    enum: WorkspaceRole,
    default: WorkspaceRole.MEMBER,
  })
  @IsOptional()
  @IsEnum(WorkspaceRole)
  role: WorkspaceRole = WorkspaceRole.MEMBER;
}
