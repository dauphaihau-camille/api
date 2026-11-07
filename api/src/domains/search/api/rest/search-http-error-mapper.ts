import type { HttpException } from '@nestjs/common';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { toHttpErrorPayload } from '~/platform/http/api-error-code';
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
    return new NotFoundException(toHttpErrorPayload(error));
  }

  return new ForbiddenException(toHttpErrorPayload(error));
}
