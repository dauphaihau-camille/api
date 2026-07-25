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
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '~/platform/decorators/current-user.decorator';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { JwtAuthGuard } from '~/domains/auth/api/guard/jwt-auth.guard';
import { PermissionsGuard } from '~/domains/auth/api/guard/permissions.guard';
import { GetDocumentAccessSettingsUseCase } from '../../app/use-cases/get-document-access-settings.use-case';
import { ListDocumentCollaboratorsUseCase } from '../../app/use-cases/list-document-collaborators.use-case';
import { ListDocumentInvitationsUseCase } from '../../app/use-cases/list-document-invitations.use-case';
import { RevokeDocumentAccessUseCase } from '../../app/use-cases/revoke-document-access.use-case';
import { RevokeDocumentInvitationUseCase } from '../../app/use-cases/revoke-document-invitation.use-case';
import { ShareDocumentUseCase } from '../../app/use-cases/share-document.use-case';
import { UpdateDocumentAccessSettingsUseCase } from '../../app/use-cases/update-document-access-settings.use-case';
import { UpdateDocumentInvitationUseCase } from '../../app/use-cases/update-document-invitation.use-case';
import { rethrowDocumentAppError } from './document-http-error-mapper';
import { DocumentAccessSettingsResponseDto } from './dto/document-access-settings-response.dto';
import {
  DocumentCollaboratorResponseDto,
  DocumentInvitationResponseDto,
  ShareDocumentsResponseDto,
} from './dto/document-collaborator-response.dto';
import { ShareDocumentDto, ShareDocumentsDto } from './dto/share-document.dto';
import { UpdateDocumentAccessSettingsDto } from './dto/update-document-access-settings.dto';
import { UpdateDocumentInvitationDto } from './dto/update-document-invitation.dto';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiCookieAuth('access_token')
@ApiTags('Document')
export class DocumentAccessController {
  constructor(
    private readonly getDocumentAccessSettingsUseCase: GetDocumentAccessSettingsUseCase,
    private readonly listDocumentCollaboratorsUseCase: ListDocumentCollaboratorsUseCase,
    private readonly listDocumentInvitationsUseCase: ListDocumentInvitationsUseCase,
    private readonly revokeDocumentAccessUseCase: RevokeDocumentAccessUseCase,
    private readonly revokeDocumentInvitationUseCase: RevokeDocumentInvitationUseCase,
    private readonly shareDocumentUseCase: ShareDocumentUseCase,
    private readonly updateDocumentAccessSettingsUseCase: UpdateDocumentAccessSettingsUseCase,
    private readonly updateDocumentInvitationUseCase: UpdateDocumentInvitationUseCase,
  ) {}

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
      .catch(rethrowDocumentAppError);
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
      .catch(rethrowDocumentAppError);
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
      .catch(rethrowDocumentAppError);
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
      .catch(rethrowDocumentAppError);
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
      .catch(rethrowDocumentAppError);

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
      .catch(rethrowDocumentAppError);
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
      .catch(rethrowDocumentAppError);
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
      .catch(rethrowDocumentAppError);
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
      .catch(rethrowDocumentAppError);
  }
}
