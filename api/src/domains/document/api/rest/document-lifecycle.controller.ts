import {
  Body,
  Controller,
  Delete,
  Header,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '~/platform/decorators/current-user.decorator';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { JwtAuthGuard } from '~/domains/auth/api/guard/jwt-auth.guard';
import { PermissionsGuard } from '~/domains/auth/api/guard/permissions.guard';
import { ArchiveDocumentUseCase } from '../../app/use-cases/archive-document.use-case';
import { PermanentlyDeleteDocumentUseCase } from '../../app/use-cases/permanently-delete-document.use-case';
import { RestoreDocumentUseCase } from '../../app/use-cases/restore-document.use-case';
import { rethrowDocumentAppError } from './document-http-error-mapper';
import { DocumentResponseDto } from './dto/document-response.dto';
import { DocumentVersionDto } from './dto/document-version.dto';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiCookieAuth('access_token')
@ApiTags('Document')
export class DocumentLifecycleController {
  constructor(
    private readonly archiveDocumentUseCase: ArchiveDocumentUseCase,
    private readonly permanentlyDeleteDocumentUseCase: PermanentlyDeleteDocumentUseCase,
    private readonly restoreDocumentUseCase: RestoreDocumentUseCase,
  ) {}

  @Post('documents/:documentId/archive')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Archive document',
  })
  @ApiOkResponse({
    type: DocumentResponseDto,
  })
  async archiveDocument(
    @Param('documentId') documentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: DocumentVersionDto,
  ): Promise<DocumentResponseDto> {
    return this.archiveDocumentUseCase
      .execute(documentId, body.version, currentUser)
      .then(DocumentResponseDto.fromSummary)
      .catch(rethrowDocumentAppError);
  }

  @Post('documents/:documentId/restore')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Restore document',
  })
  @ApiOkResponse({
    type: DocumentResponseDto,
  })
  async restoreDocument(
    @Param('documentId') documentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: DocumentVersionDto,
  ): Promise<DocumentResponseDto> {
    return this.restoreDocumentUseCase
      .execute(documentId, body.version, currentUser)
      .then(DocumentResponseDto.fromSummary)
      .catch(rethrowDocumentAppError);
  }

  @Delete('documents/:documentId')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Permanently delete document',
  })
  @ApiQuery({
    name: 'version',
    required: true,
    type: Number,
  })
  async permanentlyDeleteDocument(
    @Param('documentId') documentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('version') version: string,
  ): Promise<void> {
    return this.permanentlyDeleteDocumentUseCase
      .execute(documentId, Number(version), currentUser)
      .catch(rethrowDocumentAppError);
  }
}
