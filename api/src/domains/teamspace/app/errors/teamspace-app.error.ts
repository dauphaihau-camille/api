import { DomainError } from '~/platform/errors/domain.error';

export abstract class TeamspaceAppError extends DomainError {
  protected constructor(message: string) {
    super(message);
  }
}

export class TeamspaceNotFoundError extends TeamspaceAppError {
  constructor(teamspaceId: string) {
    super(`Teamspace ${teamspaceId} was not found.`);
  }
}

export class TeamspaceWorkspaceNotFoundError extends TeamspaceAppError {
  constructor(workspaceIdentifier: string) {
    super(`Workspace ${workspaceIdentifier} was not found.`);
  }
}

export class TeamspacePermissionDeniedError extends TeamspaceAppError {
  constructor() {
    super('You do not have permission to update this workspace.');
  }
}

export class TeamspaceVersionConflictError extends TeamspaceAppError {
  constructor() {
    super('Teamspace version conflict.');
  }
}
