import { DomainError } from '~/platform/errors/domain.error';

export abstract class WorkspaceAppError extends DomainError {
  protected constructor(message: string) {
    super(message);
  }
}

export class WorkspaceNotFoundError extends WorkspaceAppError {
  constructor(workspaceIdentifier: string) {
    super(`Workspace ${workspaceIdentifier} was not found.`);
  }
}

export class WorkspacePermissionDeniedError extends WorkspaceAppError {
  constructor() {
    super('You do not have permission to update this workspace.');
  }
}

export class WorkspaceMemberManagerPermissionDeniedError extends WorkspaceAppError {
  constructor() {
    super('You do not have permission to manage workspace members.');
  }
}

export class WorkspaceOwnerPermissionDeniedError extends WorkspaceAppError {
  constructor() {
    super('Only workspace owners can manage owner assignments.');
  }
}

export class WorkspaceSlugLengthError extends WorkspaceAppError {
  constructor() {
    super('Workspace domain must be 3 to 32 characters.');
  }
}

export class WorkspaceSlugInvalidError extends WorkspaceAppError {
  constructor() {
    super('Workspace domain is invalid.');
  }
}

export class WorkspaceSlugReservedError extends WorkspaceAppError {
  constructor() {
    super('Workspace domain is reserved.');
  }
}

export class WorkspaceSlugInUseError extends WorkspaceAppError {
  constructor() {
    super('Workspace domain is already in use.');
  }
}

export class WorkspaceVersionConflictAppError extends WorkspaceAppError {
  constructor() {
    super('Workspace version conflict.');
  }
}
