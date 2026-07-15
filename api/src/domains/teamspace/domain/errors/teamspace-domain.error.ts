import { DomainError } from '~/platform/errors/domain.error';

export abstract class TeamspaceDomainError extends DomainError {
  protected constructor(message: string) {
    super(message);
  }
}

export class TeamspaceNameTooShortError extends TeamspaceDomainError {
  constructor() {
    super('Teamspace name must be at least 2 characters.');
  }
}
