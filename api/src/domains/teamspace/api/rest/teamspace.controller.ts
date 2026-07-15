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
import { CreateTeamspaceUseCase } from '../../app/use-cases/create-teamspace.use-case';
import { ListTeamspacesUseCase } from '../../app/use-cases/list-teamspaces.use-case';
import { UpdateTeamspaceUseCase } from '../../app/use-cases/update-teamspace.use-case';
import {
  isTeamspaceLayeredError,
  mapTeamspaceLayeredErrorToHttpException,
} from './teamspace-http-error-mapper';
import { CreateTeamspaceDto } from './dto/create-teamspace.dto';
import { TeamspaceResponseDto } from './dto/teamspace-response.dto';
import { UpdateTeamspaceDto } from './dto/update-teamspace.dto';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiCookieAuth('access_token')
@ApiTags('Teamspace')
export class TeamspaceController {
  constructor(
    private readonly listTeamspacesUseCase: ListTeamspacesUseCase,
    private readonly createTeamspaceUseCase: CreateTeamspaceUseCase,
    private readonly updateTeamspaceUseCase: UpdateTeamspaceUseCase,
  ) {}

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
    return this.listTeamspacesUseCase
      .execute(workspaceId, currentUser)
      .then((teamspaces) => teamspaces.map(TeamspaceResponseDto.fromSummary))
      .catch(this.rethrowTeamspaceLayeredError);
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
    return this.createTeamspaceUseCase
      .execute(workspaceId, currentUser, {
        name: body.name,
        description: body.description,
      })
      .then(TeamspaceResponseDto.fromSummary)
      .catch(this.rethrowTeamspaceLayeredError);
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
    return this.updateTeamspaceUseCase
      .execute(teamspaceId, currentUser, {
        version: body.version,
        name: body.name,
        description: body.description,
      })
      .then(TeamspaceResponseDto.fromSummary)
      .catch(this.rethrowTeamspaceLayeredError);
  }

  private rethrowTeamspaceLayeredError(error: unknown): never {
    if (isTeamspaceLayeredError(error)) {
      throw mapTeamspaceLayeredErrorToHttpException(error);
    }

    throw error;
  }
}
