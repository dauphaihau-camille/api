export abstract class MembershipAppError extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class MembershipWorkspaceNotFoundError extends MembershipAppError {
  constructor(workspaceIdentifier: string) {
    super(`Workspace ${workspaceIdentifier} was not found.`);
  }
}

export class MembershipUserNotFoundError extends MembershipAppError {
  constructor(email: string) {
    super(`User ${email} was not found.`);
  }
}

export class MembershipAlreadyExistsError extends MembershipAppError {
  constructor() {
    super('That user is already a workspace member.');
  }
}

export class MembershipNotFoundError extends MembershipAppError {
  constructor() {
    super('Workspace member was not found.');
  }
}

export class MembershipVersionConflictError extends MembershipAppError {
  constructor() {
    super('Workspace member version conflict.');
  }
}

export class MembershipLastOwnerConflictError extends MembershipAppError {
  constructor() {
    super('Workspace must keep at least one owner.');
  }
}
