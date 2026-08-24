import { DomainError } from '~/platform/errors/domain.error';

export abstract class SubscriptionAppError extends DomainError {
  protected constructor(message: string, code?: string) {
    super(message, code);
  }
}

export class SubscriptionWorkspaceNotFoundError extends SubscriptionAppError {
  constructor(workspaceIdentifier: string) {
    super(`Workspace ${workspaceIdentifier} was not found.`);
  }
}

export class SubscriptionPermissionDeniedError extends SubscriptionAppError {
  constructor() {
    super('You do not have permission to manage this workspace subscription.');
  }
}

export class SubscriptionInvalidReturnUrlError extends SubscriptionAppError {
  constructor() {
    super('Checkout return URL is invalid.');
  }
}

export class WorkspaceBlockLimitReachedError extends SubscriptionAppError {
  constructor(
    readonly metadata: {
      plan: string;
      blockCount: number;
      blockLimit: number;
      upgradeAvailable: boolean;
    },
  ) {
    super('Workspace block limit reached.', 'workspace_block_limit_reached');
  }
}

export type WorkspaceBlockLimitReachedAppError =
  WorkspaceBlockLimitReachedError
  | {
    code: 'workspace_block_limit_reached';
    message: string;
    metadata: {
      plan: string;
      blockCount: number;
      blockLimit: number;
      upgradeAvailable: boolean;
    };
  };

export function isWorkspaceBlockLimitReachedAppError(
  error: unknown,
): error is WorkspaceBlockLimitReachedAppError {
  if (error instanceof WorkspaceBlockLimitReachedError) {
    return true;
  }

  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    code?: unknown;
    message?: unknown;
    metadata?: {
      plan?: unknown;
      blockCount?: unknown;
      blockLimit?: unknown;
      upgradeAvailable?: unknown;
    };
  };

  return candidate.code === 'workspace_block_limit_reached'
    && typeof candidate.message === 'string'
    && !!candidate.metadata
    && typeof candidate.metadata.plan === 'string'
    && typeof candidate.metadata.blockCount === 'number'
    && typeof candidate.metadata.blockLimit === 'number'
    && typeof candidate.metadata.upgradeAvailable === 'boolean';
}

export class BillingWebhookVerificationError extends SubscriptionAppError {
  constructor() {
    super('Billing webhook could not be verified.');
  }
}
