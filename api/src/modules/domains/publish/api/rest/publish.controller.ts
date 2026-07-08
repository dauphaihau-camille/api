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
import { GetPublicDocumentUseCase } from '../../app/use-cases/get-public-document.use-case';
import { GetPublishStatusUseCase } from '../../app/use-cases/get-publish-status.use-case';
import { PublishDocumentUseCase } from '../../app/use-cases/publish-document.use-case';
import { UnpublishDocumentUseCase } from '../../app/use-cases/unpublish-document.use-case';
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
  constructor(
    private readonly getPublicDocumentUseCase: GetPublicDocumentUseCase,
    private readonly getPublishStatusUseCase: GetPublishStatusUseCase,
    private readonly publishDocumentUseCase: PublishDocumentUseCase,
    private readonly unpublishDocumentUseCase: UnpublishDocumentUseCase,
  ) {}

  @Get('published/:publishedDocumentId')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Get published document',
  })
  @ApiOkResponse({
    type: PublicDocumentResponseDto,
  })
  async getPublicDocument(
    @Param('publishedDocumentId') publishedDocumentId: string,
  ): Promise<PublicDocumentResponseDto> {
    return this.getPublicDocumentUseCase
      .execute(publishedDocumentId)
      .then(PublicDocumentResponseDto.fromSummary)
      .catch(this.rethrowPublishAppError);
  }

  @Get('documents/:documentId/publish')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiCookieAuth('access_token')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Get publish status',
  })
  @ApiOkResponse({
    type: PublishedDocumentResponseDto,
  })
  async getPublishStatus(
    @Param('documentId') documentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PublishedDocumentResponseDto> {
    return this.getPublishStatusUseCase
      .execute(documentId, currentUser)
      .then(PublishedDocumentResponseDto.fromSummary)
      .catch(this.rethrowPublishAppError);
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
    return this.publishDocumentUseCase
      .execute(documentId, currentUser)
      .then(PublishedDocumentResponseDto.fromSummary)
      .catch(this.rethrowPublishAppError);
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
    return this.unpublishDocumentUseCase
      .execute(documentId, currentUser)
      .then(PublishedDocumentResponseDto.fromSummary)
      .catch(this.rethrowPublishAppError);
  }

  private rethrowPublishAppError(error: unknown): never {
    if (isPublishAppError(error)) {
      throw mapPublishAppErrorToHttpException(error);
    }

    throw error;
  }
}
