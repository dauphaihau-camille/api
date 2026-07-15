import type { HttpException } from '@nestjs/common';
import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  MembershipAlreadyExistsError,
  MembershipAppError,
  MembershipLastOwnerConflictError,
  MembershipNotFoundError,
  MembershipUserNotFoundError,
  MembershipVersionConflictError,
  MembershipWorkspaceNotFoundError,
} from '../../app/errors/membership-app.error';

export function isMembershipAppError(error: unknown): error is MembershipAppError {
  return error instanceof MembershipAppError;
}

export function mapMembershipAppErrorToHttpException(
  error: MembershipAppError,
): HttpException {
  if (
    error instanceof MembershipWorkspaceNotFoundError
    || error instanceof MembershipUserNotFoundError
    || error instanceof MembershipNotFoundError
  ) {
    return new NotFoundException(error.message);
  }

  if (
    error instanceof MembershipAlreadyExistsError
    || error instanceof MembershipVersionConflictError
    || error instanceof MembershipLastOwnerConflictError
  ) {
    return new ConflictException(error.message);
  }

  return new ConflictException(error.message);
}
