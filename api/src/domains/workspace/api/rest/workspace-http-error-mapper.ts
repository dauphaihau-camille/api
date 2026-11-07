import type { HttpException } from '@nestjs/common';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { toHttpErrorPayload } from '~/platform/http/api-error-code';
import {
  WorkspaceAppError,
  WorkspaceDeletePermissionDeniedError,
  WorkspaceMemberManagerPermissionDeniedError,
  WorkspaceNotFoundError,
  WorkspaceOwnerPermissionDeniedError,
  WorkspacePermissionDeniedError,
  WorkspaceSlugInUseError,
  WorkspaceSlugInvalidError,
  WorkspaceSlugLengthError,
  WorkspaceSlugReservedError,
  WorkspaceVersionConflictAppError,
} from '../../app/errors/workspace-app.error';

export function isWorkspaceAppError(error: unknown): error is WorkspaceAppError {
  return error instanceof WorkspaceAppError;
}

export function mapWorkspaceAppErrorToHttpException(error: WorkspaceAppError): HttpException {
  if (error instanceof WorkspaceNotFoundError) {
    return new NotFoundException(toHttpErrorPayload(error));
  }

  if (
    error instanceof WorkspacePermissionDeniedError
    || error instanceof WorkspaceMemberManagerPermissionDeniedError
    || error instanceof WorkspaceOwnerPermissionDeniedError
    || error instanceof WorkspaceDeletePermissionDeniedError
  ) {
    return new ForbiddenException(toHttpErrorPayload(error));
  }

  if (
    error instanceof WorkspaceSlugInUseError
    || error instanceof WorkspaceSlugReservedError
    || error instanceof WorkspaceVersionConflictAppError
  ) {
    return new ConflictException(toHttpErrorPayload(error));
  }

  if (
    error instanceof WorkspaceSlugLengthError
    || error instanceof WorkspaceSlugInvalidError
  ) {
    return new BadRequestException(toHttpErrorPayload(error));
  }

  return new BadRequestException(toHttpErrorPayload(error));
}
