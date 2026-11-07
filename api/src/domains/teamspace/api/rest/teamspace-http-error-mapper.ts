import type { HttpException } from '@nestjs/common';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { toHttpErrorPayload } from '~/platform/http/api-error-code';
import {
  TeamspaceAppError,
  TeamspaceNotFoundError,
  TeamspacePermissionDeniedError,
  TeamspaceVersionConflictError,
  TeamspaceWorkspaceNotFoundError,
} from '../../app/errors/teamspace-app.error';
import {
  TeamspaceDomainError,
  TeamspaceNameTooShortError,
} from '../../domain/errors/teamspace-domain.error';

export function isTeamspaceLayeredError(
  error: unknown,
): error is TeamspaceAppError | TeamspaceDomainError {
  return error instanceof TeamspaceAppError || error instanceof TeamspaceDomainError;
}

export function mapTeamspaceLayeredErrorToHttpException(
  error: TeamspaceAppError | TeamspaceDomainError,
): HttpException {
  if (
    error instanceof TeamspaceNotFoundError
    || error instanceof TeamspaceWorkspaceNotFoundError
  ) {
    return new NotFoundException(toHttpErrorPayload(error));
  }

  if (error instanceof TeamspacePermissionDeniedError) {
    return new ForbiddenException(toHttpErrorPayload(error));
  }

  if (error instanceof TeamspaceVersionConflictError) {
    return new ConflictException(toHttpErrorPayload(error));
  }

  if (error instanceof TeamspaceNameTooShortError) {
    return new BadRequestException(toHttpErrorPayload(error));
  }

  return new BadRequestException(toHttpErrorPayload(error));
}
