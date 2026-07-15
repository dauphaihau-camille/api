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
import { SearchWorkspaceDocumentsUseCase } from '../../app/use-cases/search-workspace-documents.use-case';
import { SearchDocumentResponseDto } from './dto/search-document-response.dto';
import {
  isSearchAppError,
  mapSearchAppErrorToHttpException,
} from './search-http-error-mapper';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiCookieAuth('access_token')
@ApiTags('Search')
export class SearchController {
  constructor(private readonly searchWorkspaceDocumentsUseCase: SearchWorkspaceDocumentsUseCase) {}

  @Get('workspaces/:workspaceId/search/documents')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Search workspace documents',
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
  @ApiOkResponse({
    type: SearchDocumentResponseDto,
    isArray: true,
  })
  async searchDocuments(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('q') query?: string,
    @Query('limit') limit?: number,
  ): Promise<SearchDocumentResponseDto[]> {
    try {
      const documents = await this.searchWorkspaceDocumentsUseCase
        .execute(workspaceId, currentUser, query, limit);

      return documents.map(SearchDocumentResponseDto.fromSummary);
    }
    catch (error) {
      if (isSearchAppError(error)) {
        throw mapSearchAppErrorToHttpException(error);
      }

      throw error;
    }
  }
}
