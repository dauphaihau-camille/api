import type { HttpException } from '@nestjs/common';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  WorkspaceAppError,
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
    return new NotFoundException(error.message);
  }

  if (
    error instanceof WorkspacePermissionDeniedError
    || error instanceof WorkspaceMemberManagerPermissionDeniedError
    || error instanceof WorkspaceOwnerPermissionDeniedError
  ) {
    return new ForbiddenException(error.message);
  }

  if (
    error instanceof WorkspaceSlugInUseError
    || error instanceof WorkspaceSlugReservedError
    || error instanceof WorkspaceVersionConflictAppError
  ) {
    return new ConflictException(error.message);
  }

  if (
    error instanceof WorkspaceSlugLengthError
    || error instanceof WorkspaceSlugInvalidError
  ) {
    return new BadRequestException(error.message);
  }

  return new BadRequestException(error.message);
}
