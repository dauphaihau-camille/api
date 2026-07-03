import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentUser } from "~/common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "~/modules/domains/auth/app/auth.types";
import { JwtAuthGuard } from "~/modules/domains/auth/api/guard/jwt-auth.guard";
import { PermissionsGuard } from "~/modules/domains/auth/api/guard/permissions.guard";
import { WorkspacePreferenceService } from "../../app/workspace-preference.service";
import { UpdateWorkspacePreferenceDto } from "./dto/update-workspace-preference.dto";
import { WorkspacePreferenceResponseDto } from "./dto/workspace-preference-response.dto";

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiCookieAuth("access_token")
@ApiTags("Workspace Preference")
export class WorkspacePreferenceController {
  constructor(
    private readonly workspacePreferenceService: WorkspacePreferenceService,
  ) {}

  @Get("workspaces/:workspaceId/preferences")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Get workspace sidebar preferences",
  })
  @ApiOkResponse({
    type: WorkspacePreferenceResponseDto,
  })
  async getWorkspacePreferences(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<WorkspacePreferenceResponseDto> {
    return this.workspacePreferenceService
      .getForWorkspace(workspaceId, currentUser)
      .then(WorkspacePreferenceResponseDto.fromSummary);
  }

  @Patch("workspaces/:workspaceId/preferences")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Update workspace sidebar preferences",
  })
  @ApiOkResponse({
    type: WorkspacePreferenceResponseDto,
  })
  async updateWorkspacePreferences(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: UpdateWorkspacePreferenceDto,
  ): Promise<WorkspacePreferenceResponseDto> {
    return this.workspacePreferenceService
      .updateForWorkspace(workspaceId, currentUser, {
        navigation: {
          expandedDocumentIds: body.navigation.expanded_document_ids,
        },
      })
      .then(WorkspacePreferenceResponseDto.fromSummary);
  }
}
