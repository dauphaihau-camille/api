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
import { GetWorkspacePreferenceUseCase } from '../../app/use-cases/get-workspace-preference.use-case';
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
@ApiTags('Workspace Preference')
export class WorkspacePreferenceController {
  constructor(
    private readonly getWorkspacePreferenceUseCase: GetWorkspacePreferenceUseCase,
    private readonly updateWorkspacePreferenceUseCase: UpdateWorkspacePreferenceUseCase,
  ) {}

  @Get('workspaces/:workspaceId/preferences')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Get sidebar preferences',
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
    summary: 'Update sidebar preferences',
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

  private rethrowWorkspacePreferenceAppError(error: unknown): never {
    if (isWorkspacePreferenceAppError(error)) {
      throw mapWorkspacePreferenceAppErrorToHttpException(error);
    }

    throw error;
  }
}
