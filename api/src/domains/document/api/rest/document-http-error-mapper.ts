import type { HttpException } from '@nestjs/common';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { toHttpErrorPayload } from '~/platform/http/api-error-code';
import {
  isWorkspaceBlockLimitReachedAppError,
  type WorkspaceBlockLimitReachedAppError,
} from '~/domains/subscription/app/errors/subscription-app.error';
import {
  ArchivedDocumentDuplicationError,
  DocumentAccessGrantUserNotFoundError,
  DocumentAppError,
  DocumentContentManagedByCollaborationError,
  DocumentDuplicationInvariantError,
  DocumentDescendantMoveError,
  DocumentInvitationNotFoundError,
  DocumentNotFoundError,
  DocumentNotArchivedError,
  DocumentPermissionDeniedError,
  DocumentShareRecipientRequiredError,
  DocumentTeamspaceNotFoundError,
  DocumentVersionConflictError,
  DocumentWorkspaceNotFoundError,
  InvalidDocumentCursorError,
  MoveParentDocumentWorkspaceMismatchError,
  ParentDocumentWorkspaceMismatchError,
} from '../../app/errors/document-app.error';

export function isDocumentAppError(
  error: unknown,
): error is DocumentAppError | WorkspaceBlockLimitReachedAppError {
  return error instanceof DocumentAppError || isWorkspaceBlockLimitReachedAppError(error);
}

export function mapDocumentAppErrorToHttpException(
  error: DocumentAppError | WorkspaceBlockLimitReachedAppError,
): HttpException {
  if (isWorkspaceBlockLimitReachedAppError(error)) {
    return new ForbiddenException({
      ...toHttpErrorPayload(error),
      plan: error.metadata.plan,
      block_count: error.metadata.blockCount,
      block_limit: error.metadata.blockLimit,
      upgrade_available: error.metadata.upgradeAvailable,
    });
  }

  if (
    error instanceof DocumentNotFoundError
    || error instanceof DocumentWorkspaceNotFoundError
    || error instanceof DocumentTeamspaceNotFoundError
    || error instanceof DocumentAccessGrantUserNotFoundError
    || error instanceof DocumentInvitationNotFoundError
  ) {
    return new NotFoundException(toHttpErrorPayload(error));
  }

  if (error instanceof DocumentPermissionDeniedError) {
    return new ForbiddenException(toHttpErrorPayload(error));
  }

  if (
    error instanceof DocumentVersionConflictError
    || error instanceof DocumentContentManagedByCollaborationError
  ) {
    return new ConflictException(toHttpErrorPayload(error));
  }

  if (error instanceof DocumentDuplicationInvariantError) {
    return new InternalServerErrorException(toHttpErrorPayload(error));
  }

  if (
    error instanceof ParentDocumentWorkspaceMismatchError
    || error instanceof MoveParentDocumentWorkspaceMismatchError
    || error instanceof InvalidDocumentCursorError
    || error instanceof DocumentDescendantMoveError
    || error instanceof ArchivedDocumentDuplicationError
    || error instanceof DocumentNotArchivedError
    || error instanceof DocumentShareRecipientRequiredError
  ) {
    return new BadRequestException(toHttpErrorPayload(error));
  }

  return new BadRequestException(toHttpErrorPayload(error));
}

export function rethrowDocumentAppError(error: unknown): never {
  if (isDocumentAppError(error)) {
    throw mapDocumentAppErrorToHttpException(error);
  }

  throw error;
}
