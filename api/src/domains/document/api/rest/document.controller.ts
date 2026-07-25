import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
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
import { CreateDocumentUseCase } from '../../app/use-cases/create-document.use-case';
import { DuplicateDocumentUseCase } from '../../app/use-cases/duplicate-document.use-case';
import { GetDocumentUseCase } from '../../app/use-cases/get-document.use-case';
import { ListDocumentChildrenUseCase } from '../../app/use-cases/list-document-children.use-case';
import { MoveDocumentUseCase } from '../../app/use-cases/move-document.use-case';
import { UpdateDocumentUseCase } from '../../app/use-cases/update-document.use-case';
import { rethrowDocumentAppError } from './document-http-error-mapper';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentTreeChildResponseDto } from './dto/document-children-response.dto';
import { DocumentResponseDto } from './dto/document-response.dto';
import { MoveDocumentDto } from './dto/move-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiCookieAuth('access_token')
@ApiTags('Document')
export class DocumentController {
  constructor(
    private readonly createDocumentUseCase: CreateDocumentUseCase,
    private readonly duplicateDocumentUseCase: DuplicateDocumentUseCase,
    private readonly getDocumentUseCase: GetDocumentUseCase,
    private readonly listDocumentChildrenUseCase: ListDocumentChildrenUseCase,
    private readonly moveDocumentUseCase: MoveDocumentUseCase,
    private readonly updateDocumentUseCase: UpdateDocumentUseCase,
  ) {}

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
        title: body.title,
        contentFormat: body.content_format,
        content: body.content,
      })
      .then(DocumentResponseDto.fromSummary)
      .catch(rethrowDocumentAppError);
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
      .catch(rethrowDocumentAppError);
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
      .catch(rethrowDocumentAppError);
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
      .catch(rethrowDocumentAppError);
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
      .catch(rethrowDocumentAppError);
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
      .catch(rethrowDocumentAppError);
  }
}
