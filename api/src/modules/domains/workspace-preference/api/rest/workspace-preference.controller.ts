import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '~/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { JwtAuthGuard } from '~/modules/domains/auth/api/guard/jwt-auth.guard';
import { PermissionsGuard } from '~/modules/domains/auth/api/guard/permissions.guard';
import { WorkspaceResponseDto } from '~/modules/domains/workspace/api/rest/dto/workspace-response.dto';
import { GetWorkspacePreferenceUseCase } from '../../app/use-cases/get-workspace-preference.use-case';
import { GetLastActiveWorkspaceUseCase } from '../../app/use-cases/get-last-active-workspace.use-case';
import { MarkWorkspaceAsLastActiveUseCase } from '../../app/use-cases/mark-workspace-as-last-active.use-case';
import { UpdateWorkspacePreferenceUseCase } from '../../app/use-cases/update-workspace-preference.use-case';
import { UpdateWorkspacePreferenceDto } from './dto/update-workspace-preference.dto';
import { WorkspacePreferenceResponseDto } from './dto/workspace-preference-response.dto';
import {
  isWorkspacePreferenceAppError,
  mapWorkspacePreferenceAppErrorToHttpException,
} from './workspace-preference-http-error-mapper';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiCookieAuth('access_token')
@ApiTags('Workspace User Preference')
export class WorkspacePreferenceController {
  constructor(
    private readonly getWorkspacePreferenceUseCase: GetWorkspacePreferenceUseCase,
    private readonly getLastActiveWorkspaceUseCase: GetLastActiveWorkspaceUseCase,
    private readonly markWorkspaceAsLastActiveUseCase: MarkWorkspaceAsLastActiveUseCase,
    private readonly updateWorkspacePreferenceUseCase: UpdateWorkspacePreferenceUseCase,
  ) {}

  @Get('me/workspaces/last-active')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Get last active workspace',
  })
  @ApiOkResponse({
    type: WorkspaceResponseDto,
  })
  async getLastActiveWorkspace(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<WorkspaceResponseDto | null> {
    return this.getLastActiveWorkspaceUseCase
      .execute(currentUser)
      .then((workspace) => (workspace ? WorkspaceResponseDto.fromWorkspace(workspace) : null));
  }

  @Get('workspaces/:workspaceId/preferences')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Get workspace user preferences',
  })
  @ApiOkResponse({
    type: WorkspacePreferenceResponseDto,
  })
  async getWorkspacePreferences(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<WorkspacePreferenceResponseDto> {
    return this.getWorkspacePreferenceUseCase
      .execute(workspaceId, currentUser)
      .then(WorkspacePreferenceResponseDto.fromSummary)
      .catch(this.rethrowWorkspacePreferenceAppError);
  }

  @Patch('workspaces/:workspaceId/preferences')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Update workspace user preferences',
  })
  @ApiOkResponse({
    type: WorkspacePreferenceResponseDto,
  })
  async updateWorkspacePreferences(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: UpdateWorkspacePreferenceDto,
  ): Promise<WorkspacePreferenceResponseDto> {
    return this.updateWorkspacePreferenceUseCase
      .execute(workspaceId, currentUser, {
        navigation: {
          expandedDocumentIds: body.navigation.expanded_document_ids,
        },
      })
      .then(WorkspacePreferenceResponseDto.fromSummary)
      .catch(this.rethrowWorkspacePreferenceAppError);
  }

  @Patch('workspaces/:workspaceId/preferences/last-active')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Mark workspace as last active',
  })
  async markWorkspaceAsLastActive(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    return this.markWorkspaceAsLastActiveUseCase
      .execute(workspaceId, currentUser)
      .catch(this.rethrowWorkspacePreferenceAppError);
  }

  private rethrowWorkspacePreferenceAppError(error: unknown): never {
    if (isWorkspacePreferenceAppError(error)) {
      throw mapWorkspacePreferenceAppErrorToHttpException(error);
    }

    throw error;
  }
}
