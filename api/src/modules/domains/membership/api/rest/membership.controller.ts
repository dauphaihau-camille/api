import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '~/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { JwtAuthGuard } from '~/modules/domains/auth/api/guard/jwt-auth.guard';
import { PermissionsGuard } from '~/modules/domains/auth/api/guard/permissions.guard';
import { MembershipService } from '../../app/membership.service';
import { AddWorkspaceMemberDto } from './dto/add-workspace-member.dto';
import { UpdateWorkspaceMemberDto } from './dto/update-workspace-member.dto';
import { WorkspaceMemberResponseDto } from './dto/workspace-member-response.dto';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiCookieAuth('access_token')
@ApiTags('Membership')
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  @Get('workspaces/:workspaceId/members')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'List workspace members',
  })
  @ApiOkResponse({
    type: WorkspaceMemberResponseDto,
    isArray: true,
  })
  async listWorkspaceMembers(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<WorkspaceMemberResponseDto[]> {
    return this.membershipService
      .listForWorkspace(workspaceId, currentUser)
      .then((members) => members.map(WorkspaceMemberResponseDto.fromSummary));
  }

  @Post('workspaces/:workspaceId/members')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Add workspace member',
  })
  @ApiCreatedResponse({
    type: WorkspaceMemberResponseDto,
  })
  async addWorkspaceMember(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: AddWorkspaceMemberDto,
  ): Promise<WorkspaceMemberResponseDto> {
    return this.membershipService
      .addToWorkspace(workspaceId, currentUser, {
        email: body.email,
        role: body.role,
      })
      .then(WorkspaceMemberResponseDto.fromSummary);
  }

  @Patch('workspaces/:workspaceId/members/:memberId')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Update workspace member role',
  })
  @ApiOkResponse({
    type: WorkspaceMemberResponseDto,
  })
  async updateWorkspaceMember(
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: UpdateWorkspaceMemberDto,
  ): Promise<WorkspaceMemberResponseDto> {
    return this.membershipService
      .updateWorkspaceMember(workspaceId, memberId, currentUser, {
        version: body.version,
        role: body.role,
      })
      .then(WorkspaceMemberResponseDto.fromSummary);
  }

  @Delete('workspaces/:workspaceId/members/:memberId')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Remove workspace member',
  })
  @ApiOkResponse({
    type: WorkspaceMemberResponseDto,
  })
  async removeWorkspaceMember(
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<WorkspaceMemberResponseDto> {
    return this.membershipService
      .removeFromWorkspace(workspaceId, memberId, currentUser)
      .then(WorkspaceMemberResponseDto.fromSummary);
  }
}
