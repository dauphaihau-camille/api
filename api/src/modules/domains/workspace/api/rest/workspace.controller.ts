import {
  Body,
  Controller,
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
import { CurrentUser } from '../../../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../auth/app/auth.types';
import { JwtAuthGuard } from '../../../auth/api/guard/jwt-auth.guard';
import { PermissionsGuard } from '../../../auth/api/guard/permissions.guard';
import { WorkspaceService } from '../../app/workspace.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
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
  async listMyWorkspaces(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<WorkspaceResponseDto[]> {
    return this.workspaceService
      .listForUser(currentUser)
      .then((workspaces) => workspaces.map(WorkspaceResponseDto.fromWorkspace));
  }

  @Post('workspaces')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Create workspace',
  })
  @ApiCreatedResponse({
    type: WorkspaceResponseDto,
  })
  createWorkspace(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: CreateWorkspaceDto,
  ): Promise<WorkspaceResponseDto> {
    return this.workspaceService
      .createForUser(currentUser, {
        name: body.name,
        slug: body.slug,
        description: body.description,
      })
      .then(WorkspaceResponseDto.fromWorkspace);
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
  ): Promise<WorkspaceResponseDto> {
    return this.workspaceService
      .getForUser(workspaceId, currentUser)
      .then(WorkspaceResponseDto.fromWorkspace);
  }

  @Patch('workspaces/:workspaceId')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Update workspace',
  })
  @ApiOkResponse({
    type: WorkspaceResponseDto,
  })
  updateWorkspace(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: UpdateWorkspaceDto,
  ): Promise<WorkspaceResponseDto> {
    return this.workspaceService
      .updateForUser(workspaceId, currentUser, {
        version: body.version,
        name: body.name,
        slug: body.slug,
        description: body.description,
      })
      .then(WorkspaceResponseDto.fromWorkspace);
  }
}
