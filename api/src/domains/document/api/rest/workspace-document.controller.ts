import {
  Controller,
  Get,
  Header,
  Param,
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
import { GetDefaultWorkspaceDocumentUseCase } from '../../app/use-cases/get-default-workspace-document.use-case';
import { ListArchivedWorkspaceDocumentsUseCase } from '../../app/use-cases/list-archived-workspace-documents.use-case';
import { ListWorkspaceDocumentsUseCase } from '../../app/use-cases/list-workspace-documents.use-case';
import { rethrowDocumentAppError } from './document-http-error-mapper';
import { ArchivedDocumentListPageResponseDto } from './dto/archived-document-list-response.dto';
import {
  DocumentNavigationPageResponseDto,
  WorkspaceDocumentNavigationResponseDto,
} from './dto/document-navigation-response.dto';
import { ListWorkspaceDocumentsQueryDto } from './dto/list-workspace-documents-query.dto';
import { WorkspaceDefaultDocumentResponseDto } from './dto/workspace-default-document-response.dto';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiCookieAuth('access_token')
@ApiTags('Document')
export class WorkspaceDocumentController {
  constructor(
    private readonly getDefaultWorkspaceDocumentUseCase: GetDefaultWorkspaceDocumentUseCase,
    private readonly listArchivedWorkspaceDocumentsUseCase: ListArchivedWorkspaceDocumentsUseCase,
    private readonly listWorkspaceDocumentsUseCase: ListWorkspaceDocumentsUseCase,
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
      .catch(rethrowDocumentAppError);
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
      .catch(rethrowDocumentAppError);
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
    }).catch(rethrowDocumentAppError);

    if (query.parent_document_id) {
      return DocumentNavigationPageResponseDto.fromPage(response as never);
    }

    return WorkspaceDocumentNavigationResponseDto.fromNavigation(response as never);
  }
}
