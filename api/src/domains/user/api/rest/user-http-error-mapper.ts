import type { HttpException } from '@nestjs/common';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { toHttpErrorPayload } from '~/platform/http/api-error-code';
import {
  ActorNotAllowedToCreateUsersError,
  ActorNotAllowedToUpdateUsersError,
  UserAppError,
  UserEmailAlreadyRegisteredError,
  UserNotFoundError,
  UserVersionConflictError,
} from '../../app/errors/user-app.error';

export function isUserAppError(error: unknown): error is UserAppError {
  return error instanceof UserAppError;
}

export function mapUserAppErrorToHttpException(
  error: UserAppError,
): HttpException {
  if (error instanceof ActorNotAllowedToCreateUsersError) {
    return new ForbiddenException(toHttpErrorPayload(error));
  }

  if (error instanceof ActorNotAllowedToUpdateUsersError) {
    return new ForbiddenException(toHttpErrorPayload(error));
  }

  if (error instanceof UserEmailAlreadyRegisteredError) {
    return new ConflictException(toHttpErrorPayload(error));
  }

  if (error instanceof UserVersionConflictError) {
    return new ConflictException(toHttpErrorPayload(error));
  }

  if (error instanceof UserNotFoundError) {
    return new NotFoundException(toHttpErrorPayload(error));
  }

  return new ForbiddenException(toHttpErrorPayload(error));
}
