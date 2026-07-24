import {
  Body,
  Controller,
  Delete,
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
import { CurrentUser } from '~/platform/decorators/current-user.decorator';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { JwtAuthGuard } from '~/domains/auth/api/guard/jwt-auth.guard';
import { PermissionsGuard } from '~/domains/auth/api/guard/permissions.guard';
import { ArchiveDocumentUseCase } from '../../app/use-cases/archive-document.use-case';
import { ArchiveSubdocCommandUseCase } from '../../app/use-cases/archive-subdoc-command.use-case';
import { CreateDocumentUseCase } from '../../app/use-cases/create-document.use-case';
import { CreateSubdocCommandUseCase } from '../../app/use-cases/create-subdoc-command.use-case';
import { DuplicateDocumentUseCase } from '../../app/use-cases/duplicate-document.use-case';
import { GetDefaultWorkspaceDocumentUseCase } from '../../app/use-cases/get-default-workspace-document.use-case';
import { GetDocumentUseCase } from '../../app/use-cases/get-document.use-case';
import { GetDocumentAccessSettingsUseCase } from '../../app/use-cases/get-document-access-settings.use-case';
import { ListDocumentChildrenUseCase } from '../../app/use-cases/list-document-children.use-case';
import { ListDocumentCollaboratorsUseCase } from '../../app/use-cases/list-document-collaborators.use-case';
import { ListDocumentInvitationsUseCase } from '../../app/use-cases/list-document-invitations.use-case';
import { ListArchivedWorkspaceDocumentsUseCase } from '../../app/use-cases/list-archived-workspace-documents.use-case';
import { ListWorkspaceDocumentsUseCase } from '../../app/use-cases/list-workspace-documents.use-case';
import { MoveDocumentUseCase } from '../../app/use-cases/move-document.use-case';
import { PermanentlyDeleteDocumentUseCase } from '../../app/use-cases/permanently-delete-document.use-case';
import { RevokeDocumentAccessUseCase } from '../../app/use-cases/revoke-document-access.use-case';
import { RevokeDocumentInvitationUseCase } from '../../app/use-cases/revoke-document-invitation.use-case';
import { RestoreDocumentUseCase } from '../../app/use-cases/restore-document.use-case';
import { ShareDocumentUseCase } from '../../app/use-cases/share-document.use-case';
import { UpdateDocumentUseCase } from '../../app/use-cases/update-document.use-case';
import { UpdateDocumentAccessSettingsUseCase } from '../../app/use-cases/update-document-access-settings.use-case';
import { UpdateDocumentInvitationUseCase } from '../../app/use-cases/update-document-invitation.use-case';
import {
  isDocumentAppError,
  mapDocumentAppErrorToHttpException,
} from './document-http-error-mapper';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ArchiveSubdocCommandDto } from './dto/archive-subdoc-command.dto';
import { CreateSubdocCommandDto } from './dto/create-subdoc-command.dto';
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
import { ArchivedDocumentListPageResponseDto } from './dto/archived-document-list-response.dto';
import { CreateSubdocCommandResponseDto } from './dto/create-subdoc-command-response.dto';
import { ArchiveSubdocCommandResponseDto } from './dto/archive-subdoc-command-response.dto';
import {
  DocumentCollaboratorResponseDto,
  DocumentInvitationResponseDto,
  ShareDocumentsResponseDto,
} from './dto/document-collaborator-response.dto';
import { ShareDocumentDto, ShareDocumentsDto } from './dto/share-document.dto';
import { DocumentAccessSettingsResponseDto } from './dto/document-access-settings-response.dto';
import { UpdateDocumentAccessSettingsDto } from './dto/update-document-access-settings.dto';
import { UpdateDocumentInvitationDto } from './dto/update-document-invitation.dto';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiCookieAuth('access_token')
@ApiTags('Document')
export class DocumentController {
  constructor(
    private readonly listWorkspaceDocumentsUseCase: ListWorkspaceDocumentsUseCase,
    private readonly listArchivedWorkspaceDocumentsUseCase: ListArchivedWorkspaceDocumentsUseCase,
    private readonly getDefaultWorkspaceDocumentUseCase: GetDefaultWorkspaceDocumentUseCase,
    private readonly getDocumentUseCase: GetDocumentUseCase,
    private readonly getDocumentAccessSettingsUseCase: GetDocumentAccessSettingsUseCase,
    private readonly listDocumentChildrenUseCase: ListDocumentChildrenUseCase,
    private readonly listDocumentCollaboratorsUseCase: ListDocumentCollaboratorsUseCase,
    private readonly listDocumentInvitationsUseCase: ListDocumentInvitationsUseCase,
    private readonly createDocumentUseCase: CreateDocumentUseCase,
    private readonly createSubdocCommandUseCase: CreateSubdocCommandUseCase,
    private readonly archiveSubdocCommandUseCase: ArchiveSubdocCommandUseCase,
    private readonly duplicateDocumentUseCase: DuplicateDocumentUseCase,
    private readonly updateDocumentUseCase: UpdateDocumentUseCase,
    private readonly archiveDocumentUseCase: ArchiveDocumentUseCase,
    private readonly restoreDocumentUseCase: RestoreDocumentUseCase,
    private readonly permanentlyDeleteDocumentUseCase: PermanentlyDeleteDocumentUseCase,
    private readonly moveDocumentUseCase: MoveDocumentUseCase,
    private readonly shareDocumentUseCase: ShareDocumentUseCase,
    private readonly revokeDocumentAccessUseCase: RevokeDocumentAccessUseCase,
    private readonly revokeDocumentInvitationUseCase: RevokeDocumentInvitationUseCase,
    private readonly updateDocumentAccessSettingsUseCase: UpdateDocumentAccessSettingsUseCase,
    private readonly updateDocumentInvitationUseCase: UpdateDocumentInvitationUseCase,
  ) {}

  @Get('workspaces/:workspaceId/documents/default')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Get default document',
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

  @Get('workspaces/:workspaceId/documents/archived')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'List archived workspace documents',
  })
  @ApiQuery({
    name: 'q',
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
    type: ArchivedDocumentListPageResponseDto,
  })
  async listArchivedWorkspaceDocuments(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: ListWorkspaceDocumentsQueryDto,
  ): Promise<ArchivedDocumentListPageResponseDto> {
    return this.listArchivedWorkspaceDocumentsUseCase
      .execute(workspaceId, currentUser, {
        query: query.q,
        limit: query.limit,
        cursor: query.cursor,
      })
      .then(ArchivedDocumentListPageResponseDto.fromPage)
      .catch(this.rethrowDocumentAppError);
  }

  @Get('workspaces/:workspaceId/documents')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'List workspace documents',
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
        title: body.title,
        contentFormat: body.content_format,
        content: body.content,
      })
      .then(DocumentResponseDto.fromSummary)
      .catch(this.rethrowDocumentAppError);
  }

  @Post('documents/:documentId/commands/create-subdoc')
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
      .catch(this.rethrowDocumentAppError);
  }

  @Post('documents/:documentId/commands/archive-subdoc')
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

  @Get('documents/:documentId/collaborators')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'List document collaborators',
  })
  @ApiOkResponse({
    type: DocumentCollaboratorResponseDto,
    isArray: true,
  })
  async listCollaborators(
    @Param('documentId') documentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<DocumentCollaboratorResponseDto[]> {
    return this.listDocumentCollaboratorsUseCase
      .execute(documentId, currentUser)
      .then((grants) => grants.map(DocumentCollaboratorResponseDto.fromSummary))
      .catch(this.rethrowDocumentAppError);
  }

  @Get('documents/:documentId/invitations')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'List pending document invitations',
  })
  @ApiOkResponse({
    type: DocumentInvitationResponseDto,
    isArray: true,
  })
  async listInvitations(
    @Param('documentId') documentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<DocumentInvitationResponseDto[]> {
    return this.listDocumentInvitationsUseCase
      .execute(documentId, currentUser)
      .then((invitations) => invitations.map(DocumentInvitationResponseDto.fromSummary))
      .catch(this.rethrowDocumentAppError);
  }

  @Post('documents/:documentId/share')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Share document',
  })
  @ApiOkResponse({
    type: DocumentCollaboratorResponseDto,
  })
  async shareDocument(
    @Param('documentId') documentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: ShareDocumentDto,
  ): Promise<DocumentCollaboratorResponseDto> {
    return this.shareDocumentUseCase
      .execute(documentId, currentUser, {
        userId: body.user_id,
        email: body.email,
        permission: body.permission,
      })
      .then(DocumentCollaboratorResponseDto.fromSummary)
      .catch(this.rethrowDocumentAppError);
  }

  @Post('documents/:documentId/shares')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Share document with multiple users',
  })
  @ApiOkResponse({
    type: ShareDocumentsResponseDto,
  })
  async shareDocuments(
    @Param('documentId') documentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: ShareDocumentsDto,
  ): Promise<ShareDocumentsResponseDto> {
    return this.shareDocumentUseCase
      .executeMany(documentId, currentUser, {
        grants: body.grants.map((grant) => ({
          userId: grant.user_id,
          email: grant.email,
          permission: grant.permission,
        })),
      })
      .then(ShareDocumentsResponseDto.fromSummary)
      .catch(this.rethrowDocumentAppError);
  }

  @Get('documents/:documentId/access-settings')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Get document access settings',
  })
  @ApiOkResponse({
    type: DocumentAccessSettingsResponseDto,
  })
  async getAccessSettings(
    @Param('documentId') documentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<DocumentAccessSettingsResponseDto> {
    const setting = await this.getDocumentAccessSettingsUseCase
      .execute(documentId, currentUser)
      .catch(this.rethrowDocumentAppError);

    return DocumentAccessSettingsResponseDto.fromSummary(setting, documentId);
  }

  @Patch('documents/:documentId/access-settings')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Update document access settings',
  })
  @ApiOkResponse({
    type: DocumentAccessSettingsResponseDto,
  })
  async updateAccessSettings(
    @Param('documentId') documentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: UpdateDocumentAccessSettingsDto,
  ): Promise<DocumentAccessSettingsResponseDto> {
    return this.updateDocumentAccessSettingsUseCase
      .execute(documentId, currentUser, {
        workspaceMemberPermission: body.workspace_member_permission ?? undefined,
      })
      .then(DocumentAccessSettingsResponseDto.fromSummary)
      .catch(this.rethrowDocumentAppError);
  }

  @Delete('documents/:documentId/collaborators/:userId')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Revoke document access',
  })
  async revokeDocumentAccess(
    @Param('documentId') documentId: string,
    @Param('userId') userId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    return this.revokeDocumentAccessUseCase
      .execute(documentId, currentUser, userId)
      .catch(this.rethrowDocumentAppError);
  }

  @Patch('documents/:documentId/invitations/:invitationId')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Update pending document invitation',
  })
  @ApiOkResponse({
    type: DocumentInvitationResponseDto,
  })
  async updateInvitation(
    @Param('documentId') documentId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: UpdateDocumentInvitationDto,
  ): Promise<DocumentInvitationResponseDto> {
    return this.updateDocumentInvitationUseCase
      .execute(documentId, invitationId, currentUser, {
        permission: body.permission,
      })
      .then(DocumentInvitationResponseDto.fromSummary)
      .catch(this.rethrowDocumentAppError);
  }

  @Delete('documents/:documentId/invitations/:invitationId')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Revoke pending document invitation',
  })
  async revokeInvitation(
    @Param('documentId') documentId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    return this.revokeDocumentInvitationUseCase
      .execute(documentId, invitationId, currentUser)
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
