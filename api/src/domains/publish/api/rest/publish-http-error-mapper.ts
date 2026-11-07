import type { HttpException } from '@nestjs/common';
import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { toHttpErrorPayload } from '~/platform/http/api-error-code';
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
    return new NotFoundException(toHttpErrorPayload(error));
  }

  if (
    error instanceof PublishPermissionDeniedError
    || error instanceof ArchivedDocumentPublicAccessDeniedError
  ) {
    return new ForbiddenException(toHttpErrorPayload(error));
  }

  return new ForbiddenException(toHttpErrorPayload(error));
}
