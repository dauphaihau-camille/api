import type { HttpException } from '@nestjs/common';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  SearchAppError,
  SearchWorkspaceNotFoundError,
} from '../../app/errors/search-app.error';

export function isSearchAppError(error: unknown): error is SearchAppError {
  return error instanceof SearchAppError;
}

export function mapSearchAppErrorToHttpException(
  error: SearchAppError,
): HttpException {
  if (error instanceof SearchWorkspaceNotFoundError) {
    return new NotFoundException(error.message);
  }

  return new ForbiddenException(error.message);
}
