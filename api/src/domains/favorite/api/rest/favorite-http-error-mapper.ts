import type { HttpException } from '@nestjs/common';
import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
    return new NotFoundException(error.message);
  }

  return new ForbiddenException(error.message);
}
