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
import { CurrentUser } from '~/platform/decorators/current-user.decorator';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { JwtAuthGuard } from '~/domains/auth/api/guard/jwt-auth.guard';
import { PermissionsGuard } from '~/domains/auth/api/guard/permissions.guard';
import { TeamspaceService } from '../../app/teamspace.service';
import { CreateTeamspaceDto } from './dto/create-teamspace.dto';
import { TeamspaceResponseDto } from './dto/teamspace-response.dto';
import { UpdateTeamspaceDto } from './dto/update-teamspace.dto';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiCookieAuth('access_token')
@ApiTags('Teamspace')
export class TeamspaceController {
  constructor(private readonly teamspaceService: TeamspaceService) {}

  @Get('workspaces/:workspaceId/teamspaces')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'List workspace teamspaces',
  })
  @ApiOkResponse({
    type: TeamspaceResponseDto,
    isArray: true,
  })
  async listWorkspaceTeamspaces(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<TeamspaceResponseDto[]> {
    return this.teamspaceService
      .listForWorkspace(workspaceId, currentUser)
      .then((teamspaces) => teamspaces.map(TeamspaceResponseDto.fromSummary));
  }

  @Post('workspaces/:workspaceId/teamspaces')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Create workspace teamspace',
  })
  @ApiCreatedResponse({
    type: TeamspaceResponseDto,
  })
  async createTeamspace(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: CreateTeamspaceDto,
  ): Promise<TeamspaceResponseDto> {
    return this.teamspaceService
      .createForWorkspace(workspaceId, currentUser, {
        name: body.name,
        description: body.description,
      })
      .then(TeamspaceResponseDto.fromSummary);
  }

  @Patch('teamspaces/:teamspaceId')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Update teamspace',
  })
  @ApiOkResponse({
    type: TeamspaceResponseDto,
  })
  async updateTeamspace(
    @Param('teamspaceId') teamspaceId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: UpdateTeamspaceDto,
  ): Promise<TeamspaceResponseDto> {
    return this.teamspaceService
      .updateForWorkspace(teamspaceId, currentUser, {
        version: body.version,
        name: body.name,
        description: body.description,
      })
      .then(TeamspaceResponseDto.fromSummary);
  }
}
