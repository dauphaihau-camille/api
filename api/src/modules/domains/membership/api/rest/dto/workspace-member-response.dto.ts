import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { WorkspaceMemberSummary } from '~/modules/domains/workspace/app/contracts/workspace.contract';
import { WorkspaceRole } from '~/modules/domains/workspace/domain/enums/workspace-role.enum';

export class WorkspaceMemberResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  user_id!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional()
  display_name?: string;

  @ApiPropertyOptional()
  avatar?: string;

  @ApiProperty({
    enum: WorkspaceRole,
  })
  role!: WorkspaceRole;

  @ApiProperty()
  joined_at!: string;

  static fromSummary(member: WorkspaceMemberSummary): WorkspaceMemberResponseDto {
    return {
      id: member.id,
      version: member.version,
      user_id: member.userId,
      email: member.email,
      display_name: member.displayName,
      avatar: member.avatar,
      role: member.role,
      joined_at: member.joinedAt.toISOString(),
    };
  }
}
