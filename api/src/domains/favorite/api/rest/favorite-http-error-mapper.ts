import type { HttpException } from '@nestjs/common';
import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { toHttpErrorPayload } from '~/platform/http/api-error-code';
import {
  FavoriteAppError,
  FavoriteDocumentNotFoundError,
  FavoriteWorkspaceNotFoundError,
} from '../../app/errors/favorite-app.error';

export function isFavoriteAppError(error: unknown): error is FavoriteAppError {
  return error instanceof FavoriteAppError;
}

export function mapFavoriteAppErrorToHttpException(
  error: FavoriteAppError,
): HttpException {
  if (
    error instanceof FavoriteDocumentNotFoundError
    || error instanceof FavoriteWorkspaceNotFoundError
  ) {
    return new NotFoundException(toHttpErrorPayload(error));
  }

  return new ForbiddenException(toHttpErrorPayload(error));
}
