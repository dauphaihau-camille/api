import { Controller, Get, Header, Param, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../auth/app/auth.types';
import { JwtAuthGuard } from '../../../auth/api/guard/jwt-auth.guard';
import { PermissionsGuard } from '../../../auth/api/guard/permissions.guard';
import { WorkspaceService } from '../../app/workspace.service';
import { WorkspaceResponseDto } from './dto/workspace-response.dto';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiCookieAuth('access_token')
@ApiTags('Workspace')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get('me/workspaces')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'List current user workspaces',
  })
  @ApiOkResponse({
    type: WorkspaceResponseDto,
    isArray: true,
  })
  listMyWorkspaces(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): WorkspaceResponseDto[] {
    return this.workspaceService
      .listForUser(currentUser)
      .map(WorkspaceResponseDto.fromWorkspace);
  }

  @Get('workspaces/:workspaceId')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Get workspace detail',
  })
  @ApiOkResponse({
    type: WorkspaceResponseDto,
  })
  getWorkspace(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): WorkspaceResponseDto {
    return WorkspaceResponseDto.fromWorkspace(
      this.workspaceService.getForUser(workspaceId, currentUser),
    );
  }
}
