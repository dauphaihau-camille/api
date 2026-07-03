import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '~/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { JwtAuthGuard } from '~/modules/domains/auth/api/guard/jwt-auth.guard';
import { PermissionsGuard } from '~/modules/domains/auth/api/guard/permissions.guard';
import { FavoriteService } from '../../app/favorite.service';
import { FavoriteDocumentResponseDto } from './dto/favorite-document-response.dto';
import { FavoriteStatusResponseDto } from './dto/favorite-status-response.dto';
import {
  isFavoriteAppError,
  mapFavoriteAppErrorToHttpException,
} from './favorite-http-error-mapper';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiCookieAuth('access_token')
@ApiTags('Favorite')
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

  @Get('workspaces/:workspaceId/favorites')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'List workspace favorite documents',
  })
  @ApiOkResponse({
    type: FavoriteDocumentResponseDto,
    isArray: true,
  })
  async listWorkspaceFavorites(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<FavoriteDocumentResponseDto[]> {
    try {
      return await this.favoriteService
        .listForWorkspace(workspaceId, currentUser)
        .then((favorites) => favorites.map(FavoriteDocumentResponseDto.fromSummary));
    }
    catch (error) {
      if (isFavoriteAppError(error)) {
        throw mapFavoriteAppErrorToHttpException(error);
      }

      throw error;
    }
  }

  @Get('documents/:documentId/favorite')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Get favorite status for a document',
  })
  @ApiOkResponse({
    type: FavoriteStatusResponseDto,
  })
  async getFavoriteStatus(
    @Param('documentId') documentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<FavoriteStatusResponseDto> {
    try {
      return await this.favoriteService
        .getStatusForDocument(documentId, currentUser)
        .then(FavoriteStatusResponseDto.fromSummary);
    }
    catch (error) {
      if (isFavoriteAppError(error)) {
        throw mapFavoriteAppErrorToHttpException(error);
      }

      throw error;
    }
  }

  @Post('documents/:documentId/favorite')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Favorite a document',
  })
  @ApiOkResponse({
    type: FavoriteStatusResponseDto,
  })
  async favoriteDocument(
    @Param('documentId') documentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<FavoriteStatusResponseDto> {
    try {
      return await this.favoriteService
        .addForDocument(documentId, currentUser)
        .then(FavoriteStatusResponseDto.fromSummary);
    }
    catch (error) {
      if (isFavoriteAppError(error)) {
        throw mapFavoriteAppErrorToHttpException(error);
      }

      throw error;
    }
  }

  @Delete('documents/:documentId/favorite')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Remove document favorite',
  })
  @ApiOkResponse({
    type: FavoriteStatusResponseDto,
  })
  async unfavoriteDocument(
    @Param('documentId') documentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<FavoriteStatusResponseDto> {
    try {
      return await this.favoriteService
        .removeForDocument(documentId, currentUser)
        .then(FavoriteStatusResponseDto.fromSummary);
    }
    catch (error) {
      if (isFavoriteAppError(error)) {
        throw mapFavoriteAppErrorToHttpException(error);
      }

      throw error;
    }
  }
}
