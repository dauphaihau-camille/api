import { DomainError } from '~/platform/errors/domain.error';

export abstract class DocumentAppError extends DomainError {
  protected constructor(message: string) {
    super(message);
  }
}

export class DocumentNotFoundError extends DocumentAppError {
  constructor(documentIdentifier: string) {
    super(`Document ${documentIdentifier} was not found.`);
  }
}

export class DocumentWorkspaceNotFoundError extends DocumentAppError {
  constructor(workspaceIdentifier: string) {
    super(`Workspace ${workspaceIdentifier} was not found.`);
  }
}

export class DocumentTeamspaceNotFoundError extends DocumentAppError {
  constructor(teamspaceId: string) {
    super(`Teamspace ${teamspaceId} was not found.`);
  }
}

export class DocumentPermissionDeniedError extends DocumentAppError {
  constructor() {
    super('You do not have permission to update this workspace.');
  }
}

export class ParentDocumentWorkspaceMismatchError extends DocumentAppError {
  constructor() {
    super('Parent document does not belong to the selected workspace.');
  }
}

export class MoveParentDocumentWorkspaceMismatchError extends DocumentAppError {
  constructor() {
    super('Parent document does not belong to this workspace.');
  }
}

export class InvalidDocumentCursorError extends DocumentAppError {
  constructor() {
    super('Invalid document cursor.');
  }
}

export class DocumentVersionConflictError extends DocumentAppError {
  constructor() {
    super('Document version conflict.');
  }
}

export class DocumentDescendantMoveError extends DocumentAppError {
  constructor() {
    super('Document cannot be moved into one of its descendants.');
  }
}

export class ArchivedDocumentDuplicationError extends DocumentAppError {
  constructor() {
    super('Archived document cannot be duplicated.');
  }
}

export class DocumentDuplicationInvariantError extends DocumentAppError {
  constructor(details: string) {
    super(`Document duplication invariant failed: ${details}.`);
  }
}

export class DocumentNotArchivedError extends DocumentAppError {
  constructor() {
    super('Document must be in trash before it can be permanently deleted.');
  }
}
