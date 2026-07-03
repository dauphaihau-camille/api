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
import { PublishService } from '../../app/publish.service';
import {
  PublicDocumentResponseDto,
  PublishedDocumentResponseDto,
} from './dto/published-document-response.dto';
import {
  isPublishAppError,
  mapPublishAppErrorToHttpException,
} from './publish-http-error-mapper';

@Controller()
@ApiTags('Publish')
export class PublishController {
  constructor(private readonly publishService: PublishService) {}

  @Get('published/:publishedDocumentId')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Get a publicly published document',
  })
  @ApiOkResponse({
    type: PublicDocumentResponseDto,
  })
  async getPublicDocument(
    @Param('publishedDocumentId') publishedDocumentId: string,
  ): Promise<PublicDocumentResponseDto> {
    try {
      return await this.publishService
        .getPublicDocument(publishedDocumentId)
        .then(PublicDocumentResponseDto.fromSummary);
    }
    catch (error) {
      if (isPublishAppError(error)) {
        throw mapPublishAppErrorToHttpException(error);
      }

      throw error;
    }
  }

  @Get('documents/:documentId/publish')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiCookieAuth('access_token')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Get document publish status',
  })
  @ApiOkResponse({
    type: PublishedDocumentResponseDto,
  })
  async getPublishStatus(
    @Param('documentId') documentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PublishedDocumentResponseDto> {
    try {
      return await this.publishService
        .getStatusForDocument(documentId, currentUser)
        .then(PublishedDocumentResponseDto.fromSummary);
    }
    catch (error) {
      if (isPublishAppError(error)) {
        throw mapPublishAppErrorToHttpException(error);
      }

      throw error;
    }
  }

  @Post('documents/:documentId/publish')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiCookieAuth('access_token')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Publish a document',
  })
  @ApiOkResponse({
    type: PublishedDocumentResponseDto,
  })
  async publishDocument(
    @Param('documentId') documentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PublishedDocumentResponseDto> {
    try {
      return await this.publishService
        .publishDocument(documentId, currentUser)
        .then(PublishedDocumentResponseDto.fromSummary);
    }
    catch (error) {
      if (isPublishAppError(error)) {
        throw mapPublishAppErrorToHttpException(error);
      }

      throw error;
    }
  }

  @Delete('documents/:documentId/publish')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiCookieAuth('access_token')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Unpublish a document',
  })
  @ApiOkResponse({
    type: PublishedDocumentResponseDto,
  })
  async unpublishDocument(
    @Param('documentId') documentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PublishedDocumentResponseDto> {
    try {
      return await this.publishService
        .unpublishDocument(documentId, currentUser)
        .then(PublishedDocumentResponseDto.fromSummary);
    }
    catch (error) {
      if (isPublishAppError(error)) {
        throw mapPublishAppErrorToHttpException(error);
      }

      throw error;
    }
  }
}
