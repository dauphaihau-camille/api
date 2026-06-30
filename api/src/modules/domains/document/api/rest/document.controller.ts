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
import { DocumentService } from '../../app/document.service';
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
  constructor(private readonly documentService: DocumentService) {}

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
    return this.documentService
      .getDefaultDocumentForWorkspace(workspaceId, currentUser, recentDocumentId)
      .then(WorkspaceDefaultDocumentResponseDto.fromDefaultDocument);
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
    const response = await this.documentService.listForWorkspace(workspaceId, currentUser, {
      query: query.q,
      parentDocumentId: query.parent_document_id,
      limit: query.limit,
      cursor: query.cursor,
    });

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
    return this.documentService
      .createForUser(currentUser, {
        workspaceId: body.workspace_id,
        teamspaceId: body.teamspace_id,
        parentDocumentId: body.parent_document_id,
        title: body.title,
        contentFormat: body.content_format,
        content: body.content,
      })
      .then(DocumentResponseDto.fromSummary);
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
    return this.documentService
      .getForUser(documentId, currentUser)
      .then(DocumentResponseDto.fromSummary);
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
    return this.documentService
      .listChildrenForUser(documentId, currentUser)
      .then((documents) => documents.map(DocumentTreeChildResponseDto.fromNode));
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
    return this.documentService
      .updateForUser(documentId, currentUser, {
        version: body.version,
        title: body.title,
        contentFormat: body.content_format,
        content: body.content,
      })
      .then(DocumentResponseDto.fromSummary);
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
    return this.documentService
      .archiveForUser(documentId, body.version, currentUser)
      .then(DocumentResponseDto.fromSummary);
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
    return this.documentService
      .restoreForUser(documentId, body.version, currentUser)
      .then(DocumentResponseDto.fromSummary);
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
    return this.documentService
      .moveForUser(documentId, currentUser, {
        version: body.version,
        parentDocumentId: body.parent_document_id,
        teamspaceId: body.teamspace_id,
        index: body.index,
      })
      .then(DocumentResponseDto.fromSummary);
  }
}
