import type { HttpException } from '@nestjs/common';
import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ArchivedDocumentPublicAccessDeniedError,
  PublishAppError,
  PublishDocumentNotFoundError,
  PublishedDocumentNotFoundError,
  PublishPermissionDeniedError,
  PublishWorkspaceNotFoundError,
} from '../../app/errors/publish-app.error';

export function isPublishAppError(error: unknown): error is PublishAppError {
  return error instanceof PublishAppError;
}

export function mapPublishAppErrorToHttpException(
  error: PublishAppError,
): HttpException {
  if (
    error instanceof PublishDocumentNotFoundError
    || error instanceof PublishWorkspaceNotFoundError
    || error instanceof PublishedDocumentNotFoundError
  ) {
    return new NotFoundException(error.message);
  }

  if (
    error instanceof PublishPermissionDeniedError
    || error instanceof ArchivedDocumentPublicAccessDeniedError
  ) {
    return new ForbiddenException(error.message);
  }

  return new ForbiddenException(error.message);
}
