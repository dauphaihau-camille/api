import {
  Body,
  Controller,
  Header,
  HttpCode,
  Param,
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
import { ArchiveSubdocCommandUseCase } from '../../app/use-cases/archive-subdoc-command.use-case';
import { CreateSubdocCommandUseCase } from '../../app/use-cases/create-subdoc-command.use-case';
import { rethrowDocumentAppError } from './document-http-error-mapper';
import { ArchiveSubdocCommandResponseDto } from './dto/archive-subdoc-command-response.dto';
import { ArchiveSubdocCommandDto } from './dto/archive-subdoc-command.dto';
import { CreateSubdocCommandResponseDto } from './dto/create-subdoc-command-response.dto';
import { CreateSubdocCommandDto } from './dto/create-subdoc-command.dto';
import {
  documentNotFoundErrorExample,
  documentPermissionDeniedErrorExample,
  documentVersionConflictErrorExample,
  parentDocumentWorkspaceMismatchErrorExample,
  workspaceBlockLimitReachedErrorExample,
} from './document-error-responses';
import { unauthorizedErrorExample } from '~/domains/auth/api/rest/auth-error-examples';
import {
  internalServerErrorExample,
  tooManyRequestsErrorExample,
  validationErrorExample,
} from '~/platform/http/api-error-examples';
import { ApiErrorResponses } from '~/platform/http/api-error-responses.decorator';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiErrorResponses({
  429: [tooManyRequestsErrorExample],
})
@ApiCookieAuth('access_token')
@ApiTags('Document')
export class DocumentCommandController {
  constructor(
    private readonly archiveSubdocCommandUseCase: ArchiveSubdocCommandUseCase,
    private readonly createSubdocCommandUseCase: CreateSubdocCommandUseCase,
  ) {}

  @Post('documents/:documentId/commands/create-subdoc')
  @ApiErrorResponses({
    400: [validationErrorExample, parentDocumentWorkspaceMismatchErrorExample],
    401: [unauthorizedErrorExample],
    403: [workspaceBlockLimitReachedErrorExample, documentPermissionDeniedErrorExample],
    404: [documentNotFoundErrorExample],
    409: [documentVersionConflictErrorExample],
    500: [internalServerErrorExample],
  })
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Create subdocument command',
  })
  @ApiCreatedResponse({
    type: CreateSubdocCommandResponseDto,
  })
  async createSubdoc(
    @Param('documentId') documentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: CreateSubdocCommandDto,
  ): Promise<CreateSubdocCommandResponseDto> {
    return this.createSubdocCommandUseCase
      .execute(currentUser, documentId, {
        anchorBlockId: body.anchor_block_id,
        slashCommandText: body.slash_command_text,
        version: body.version,
        content: body.content,
      })
      .then(CreateSubdocCommandResponseDto.fromResult)
      .catch(rethrowDocumentAppError);
  }

  @Post('documents/:documentId/commands/archive-subdoc')
  @ApiErrorResponses({
    400: [validationErrorExample],
    401: [unauthorizedErrorExample],
    403: [documentPermissionDeniedErrorExample],
    404: [documentNotFoundErrorExample],
    409: [documentVersionConflictErrorExample],
    500: [internalServerErrorExample],
  })
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Archive subdocument command',
  })
  @ApiOkResponse({
    type: ArchiveSubdocCommandResponseDto,
  })
  async archiveSubdoc(
    @Param('documentId') documentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: ArchiveSubdocCommandDto,
  ): Promise<ArchiveSubdocCommandResponseDto> {
    return this.archiveSubdocCommandUseCase
      .execute(currentUser, documentId, {
        subdocumentId: body.subdocument_id,
        version: body.version,
        content: body.content,
      })
      .then(ArchiveSubdocCommandResponseDto.fromResult)
      .catch(rethrowDocumentAppError);
  }
}
