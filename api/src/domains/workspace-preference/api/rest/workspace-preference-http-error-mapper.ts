import type { HttpException } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { toHttpErrorPayload } from '~/platform/http/api-error-code';
import {
  WorkspacePreferenceAppError,
  WorkspacePreferenceWorkspaceNotFoundError,
} from '../../app/errors/workspace-preference-app.error';

export function isWorkspacePreferenceAppError(
  error: unknown,
): error is WorkspacePreferenceAppError {
  return error instanceof WorkspacePreferenceAppError;
}

export function mapWorkspacePreferenceAppErrorToHttpException(
  error: WorkspacePreferenceAppError,
): HttpException {
  if (error instanceof WorkspacePreferenceWorkspaceNotFoundError) {
    return new NotFoundException(toHttpErrorPayload(error));
  }

  return new NotFoundException(toHttpErrorPayload(error));
}
