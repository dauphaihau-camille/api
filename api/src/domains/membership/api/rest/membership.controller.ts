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
import { CurrentUser } from '~/platform/decorators/current-user.decorator';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { JwtAuthGuard } from '~/domains/auth/api/guard/jwt-auth.guard';
import { PermissionsGuard } from '~/domains/auth/api/guard/permissions.guard';
import { AddWorkspaceMemberUseCase } from '../../app/use-cases/add-workspace-member.use-case';
import { ListWorkspaceMembersUseCase } from '../../app/use-cases/list-workspace-members.use-case';
import { RemoveWorkspaceMemberUseCase } from '../../app/use-cases/remove-workspace-member.use-case';
import { UpdateWorkspaceMemberUseCase } from '../../app/use-cases/update-workspace-member.use-case';
import { AddWorkspaceMemberDto } from './dto/add-workspace-member.dto';
import { UpdateWorkspaceMemberDto } from './dto/update-workspace-member.dto';
import { WorkspaceMemberResponseDto } from './dto/workspace-member-response.dto';
import {
  isMembershipAppError,
  mapMembershipAppErrorToHttpException,
} from './membership-http-error-mapper';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiCookieAuth('access_token')
@ApiTags('Membership')
export class MembershipController {
  constructor(
    private readonly listWorkspaceMembersUseCase: ListWorkspaceMembersUseCase,
    private readonly addWorkspaceMemberUseCase: AddWorkspaceMemberUseCase,
    private readonly updateWorkspaceMemberUseCase: UpdateWorkspaceMemberUseCase,
    private readonly removeWorkspaceMemberUseCase: RemoveWorkspaceMemberUseCase,
  ) {}

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
    return this.listWorkspaceMembersUseCase
      .execute(workspaceId, currentUser)
      .then((members) => members.map(WorkspaceMemberResponseDto.fromSummary))
      .catch(this.rethrowMembershipAppError);
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
    return this.addWorkspaceMemberUseCase
      .execute(workspaceId, currentUser, {
        email: body.email,
        role: body.role,
      })
      .then(WorkspaceMemberResponseDto.fromSummary)
      .catch(this.rethrowMembershipAppError);
  }

  @Patch('workspaces/:workspaceId/members/:memberId')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Update member role',
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
    return this.updateWorkspaceMemberUseCase
      .execute(workspaceId, memberId, currentUser, {
        version: body.version,
        role: body.role,
      })
      .then(WorkspaceMemberResponseDto.fromSummary)
      .catch(this.rethrowMembershipAppError);
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
    return this.removeWorkspaceMemberUseCase
      .execute(workspaceId, memberId, currentUser)
      .then(WorkspaceMemberResponseDto.fromSummary)
      .catch(this.rethrowMembershipAppError);
  }

  private rethrowMembershipAppError(error: unknown): never {
    if (isMembershipAppError(error)) {
      throw mapMembershipAppErrorToHttpException(error);
    }

    throw error;
  }
}
