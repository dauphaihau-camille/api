import type { HttpException } from '@nestjs/common';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ArchivedDocumentDuplicationError,
  DocumentAppError,
  DocumentDescendantMoveError,
  DocumentNotFoundError,
  DocumentPermissionDeniedError,
  DocumentTeamspaceNotFoundError,
  DocumentVersionConflictError,
  DocumentWorkspaceNotFoundError,
  InvalidDocumentCursorError,
  MoveParentDocumentWorkspaceMismatchError,
  ParentDocumentWorkspaceMismatchError,
} from '../../app/errors/document-app.error';

export function isDocumentAppError(error: unknown): error is DocumentAppError {
  return error instanceof DocumentAppError;
}

export function mapDocumentAppErrorToHttpException(error: DocumentAppError): HttpException {
  if (
    error instanceof DocumentNotFoundError
    || error instanceof DocumentWorkspaceNotFoundError
    || error instanceof DocumentTeamspaceNotFoundError
  ) {
    return new NotFoundException(error.message);
  }

  if (error instanceof DocumentPermissionDeniedError) {
    return new ForbiddenException(error.message);
  }

  if (error instanceof DocumentVersionConflictError) {
    return new ConflictException(error.message);
  }

  if (
    error instanceof ParentDocumentWorkspaceMismatchError
    || error instanceof MoveParentDocumentWorkspaceMismatchError
    || error instanceof InvalidDocumentCursorError
    || error instanceof DocumentDescendantMoveError
    || error instanceof ArchivedDocumentDuplicationError
  ) {
    return new BadRequestException(error.message);
  }

  return new BadRequestException(error.message);
}
