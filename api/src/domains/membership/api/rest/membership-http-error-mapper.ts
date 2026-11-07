import type { HttpException } from '@nestjs/common';
import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { toHttpErrorPayload } from '~/platform/http/api-error-code';
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
    return new NotFoundException(toHttpErrorPayload(error));
  }

  if (
    error instanceof MembershipAlreadyExistsError
    || error instanceof MembershipVersionConflictError
    || error instanceof MembershipLastOwnerConflictError
  ) {
    return new ConflictException(toHttpErrorPayload(error));
  }

  return new ConflictException(toHttpErrorPayload(error));
}
