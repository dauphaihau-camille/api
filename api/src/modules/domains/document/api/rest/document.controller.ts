import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '~/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { JwtAuthGuard } from '~/modules/domains/auth/api/guard/jwt-auth.guard';
import { PermissionsGuard } from '~/modules/domains/auth/api/guard/permissions.guard';
import { ArchiveDocumentUseCase } from '../../app/use-cases/archive-document.use-case';
import { CreateDocumentUseCase } from '../../app/use-cases/create-document.use-case';
import { DuplicateDocumentUseCase } from '../../app/use-cases/duplicate-document.use-case';
import { GetDefaultWorkspaceDocumentUseCase } from '../../app/use-cases/get-default-workspace-document.use-case';
import { GetDocumentUseCase } from '../../app/use-cases/get-document.use-case';
import { ListDocumentChildrenUseCase } from '../../app/use-cases/list-document-children.use-case';
import { ListWorkspaceDocumentsUseCase } from '../../app/use-cases/list-workspace-documents.use-case';
import { MoveDocumentUseCase } from '../../app/use-cases/move-document.use-case';
import { RestoreDocumentUseCase } from '../../app/use-cases/restore-document.use-case';
import { UpdateDocumentUseCase } from '../../app/use-cases/update-document.use-case';
import {
  isDocumentAppError,
  mapDocumentAppErrorToHttpException,
} from './document-http-error-mapper';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ListWorkspaceDocumentsQueryDto } from './dto/list-workspace-documents-query.dto';
import { DocumentResponseDto } from './dto/document-response.dto';
import { DocumentVersionDto } from './dto/document-version.dto';
import { MoveDocumentDto } from './dto/move-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DocumentTreeChildResponseDto } from './dto/document-children-response.dto';
import {
  DocumentNavigationPageResponseDto,
  WorkspaceDocumentNavigationResponseDto,
} from './dto/document-navigation-response.dto';
import { WorkspaceDefaultDocumentResponseDto } from './dto/workspace-default-document-response.dto';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiCookieAuth('access_token')
@ApiTags('Document')
export class DocumentController {
  constructor(
    private readonly listWorkspaceDocumentsUseCase: ListWorkspaceDocumentsUseCase,
    private readonly getDefaultWorkspaceDocumentUseCase: GetDefaultWorkspaceDocumentUseCase,
    private readonly getDocumentUseCase: GetDocumentUseCase,
    private readonly listDocumentChildrenUseCase: ListDocumentChildrenUseCase,
    private readonly createDocumentUseCase: CreateDocumentUseCase,
    private readonly duplicateDocumentUseCase: DuplicateDocumentUseCase,
    private readonly updateDocumentUseCase: UpdateDocumentUseCase,
    private readonly archiveDocumentUseCase: ArchiveDocumentUseCase,
    private readonly restoreDocumentUseCase: RestoreDocumentUseCase,
    private readonly moveDocumentUseCase: MoveDocumentUseCase,
  ) {}

  @Get('workspaces/:workspaceId/documents/default')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Get default workspace document',
  })
  @ApiQuery({
    name: 'recent_document_id',
    required: false,
    type: String,
  })
  @ApiOkResponse({
    type: WorkspaceDefaultDocumentResponseDto,
  })
  async getWorkspaceDefaultDocument(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('recent_document_id') recentDocumentId?: string,
  ): Promise<WorkspaceDefaultDocumentResponseDto> {
    return this.getDefaultWorkspaceDocumentUseCase
      .execute(workspaceId, currentUser, recentDocumentId)
      .then(WorkspaceDefaultDocumentResponseDto.fromDefaultDocument)
      .catch(this.rethrowDocumentAppError);
  }

  @Get('workspaces/:workspaceId/documents')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'List workspace documents for navigation',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'parent_document_id',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
  })
  @ApiOkResponse({
    type: WorkspaceDocumentNavigationResponseDto,
    description: 'Grouped root documents when parent_document_id is omitted.',
  })
  async listWorkspaceDocuments(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: ListWorkspaceDocumentsQueryDto,
  ): Promise<WorkspaceDocumentNavigationResponseDto | DocumentNavigationPageResponseDto> {
    const response = await this.listWorkspaceDocumentsUseCase.execute(workspaceId, currentUser, {
      query: query.q,
      parentDocumentId: query.parent_document_id,
      limit: query.limit,
      cursor: query.cursor,
    }).catch(this.rethrowDocumentAppError);

    if (query.parent_document_id) {
      return DocumentNavigationPageResponseDto.fromPage(response as never);
    }

    return WorkspaceDocumentNavigationResponseDto.fromNavigation(response as never);
  }

  @Post('documents')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Create document',
  })
  @ApiCreatedResponse({
    type: DocumentResponseDto,
  })
  async createDocument(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: CreateDocumentDto,
  ): Promise<DocumentResponseDto> {
    return this.createDocumentUseCase
      .execute(currentUser, {
        workspaceId: body.workspace_id,
        teamspaceId: body.teamspace_id,
        parentDocumentId: body.parent_document_id,
        title: body.title,
        contentFormat: body.content_format,
        content: body.content,
      })
      .then(DocumentResponseDto.fromSummary)
      .catch(this.rethrowDocumentAppError);
  }

  @Post('documents/:documentId/duplicate')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Duplicate document subtree',
  })
  @ApiCreatedResponse({
    type: DocumentResponseDto,
  })
  async duplicateDocument(
    @Param('documentId') documentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<DocumentResponseDto> {
    return this.duplicateDocumentUseCase
      .execute(documentId, currentUser)
      .then(DocumentResponseDto.fromSummary)
      .catch(this.rethrowDocumentAppError);
  }

  @Get('documents/:documentId')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Get document detail',
  })
  @ApiOkResponse({
    type: DocumentResponseDto,
  })
  async getDocument(
    @Param('documentId') documentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<DocumentResponseDto> {
    return this.getDocumentUseCase
      .execute(documentId, currentUser)
      .then(DocumentResponseDto.fromSummary)
      .catch(this.rethrowDocumentAppError);
  }

  @Get('documents/:documentId/children')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'List document children',
  })
  @ApiOkResponse({
    type: DocumentTreeChildResponseDto,
    isArray: true,
  })
  async listDocumentChildren(
    @Param('documentId') documentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<DocumentTreeChildResponseDto[]> {
    return this.listDocumentChildrenUseCase
      .execute(documentId, currentUser)
      .then((documents) => documents.map(DocumentTreeChildResponseDto.fromNode))
      .catch(this.rethrowDocumentAppError);
  }

  @Patch('documents/:documentId')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Update document',
  })
  @ApiOkResponse({
    type: DocumentResponseDto,
  })
  async updateDocument(
    @Param('documentId') documentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: UpdateDocumentDto,
  ): Promise<DocumentResponseDto> {
    return this.updateDocumentUseCase
      .execute(documentId, currentUser, {
        version: body.version,
        title: body.title,
        contentFormat: body.content_format,
        content: body.content,
      })
      .then(DocumentResponseDto.fromSummary)
      .catch(this.rethrowDocumentAppError);
  }

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
      .catch(this.rethrowDocumentAppError);
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
      .catch(this.rethrowDocumentAppError);
  }

  @Post('documents/:documentId/move')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Move document',
  })
  @ApiOkResponse({
    type: DocumentResponseDto,
  })
  async moveDocument(
    @Param('documentId') documentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: MoveDocumentDto,
  ): Promise<DocumentResponseDto> {
    return this.moveDocumentUseCase
      .execute(documentId, currentUser, {
        version: body.version,
        parentDocumentId: body.parent_document_id,
        teamspaceId: body.teamspace_id,
        index: body.index,
      })
      .then(DocumentResponseDto.fromSummary)
      .catch(this.rethrowDocumentAppError);
  }

  private rethrowDocumentAppError(error: unknown): never {
    if (isDocumentAppError(error)) {
      throw mapDocumentAppErrorToHttpException(error);
    }

    throw error;
  }
}
