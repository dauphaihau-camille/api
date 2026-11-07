import type { HttpException } from '@nestjs/common';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { toHttpErrorPayload } from '~/platform/http/api-error-code';
import {
  AuthAppError,
  EmailAuthAccountNotFoundError,
  EmailAlreadyRegisteredError,
  EmailLoginCodeExpiredError,
  InactiveUserError,
  InvalidCredentialsError,
  InvalidEmailLoginCodeError,
  InvalidPasswordResetTokenError,
  InvalidRefreshTokenError,
  OAuthEmailNotVerifiedError,
  PasswordResetTokenExpiredError,
  RefreshSessionInactiveError,
  RefreshSessionNotFoundError,
  RefreshTokenMismatchError,
  SessionNotActiveError,
  UserNotFoundError,
} from '../../app/errors/auth-app.error';

export function isAuthAppError(error: unknown): error is AuthAppError {
  return error instanceof AuthAppError;
}

export function mapAuthAppErrorToHttpException(
  error: AuthAppError,
): HttpException {
  if (
    error instanceof InvalidCredentialsError
    || error instanceof SessionNotActiveError
    || error instanceof UserNotFoundError
    || error instanceof InvalidEmailLoginCodeError
    || error instanceof InvalidRefreshTokenError
    || error instanceof EmailLoginCodeExpiredError
    || error instanceof InvalidPasswordResetTokenError
    || error instanceof OAuthEmailNotVerifiedError
    || error instanceof PasswordResetTokenExpiredError
    || error instanceof RefreshSessionNotFoundError
    || error instanceof RefreshSessionInactiveError
    || error instanceof RefreshTokenMismatchError
  ) {
    return new UnauthorizedException(toHttpErrorPayload(error));
  }

  if (error instanceof InactiveUserError) {
    return new ForbiddenException(toHttpErrorPayload(error));
  }

  if (error instanceof EmailAuthAccountNotFoundError) {
    return new NotFoundException(toHttpErrorPayload(error));
  }

  if (error instanceof EmailAlreadyRegisteredError) {
    return new ConflictException(toHttpErrorPayload(error));
  }

  return new UnauthorizedException(toHttpErrorPayload(error));
}
