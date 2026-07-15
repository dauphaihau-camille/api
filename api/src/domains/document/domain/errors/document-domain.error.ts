import { DomainError } from '~/platform/errors/domain.error';

export abstract class DocumentDomainError extends DomainError {
  protected constructor(message: string) {
    super(message);
  }
}
