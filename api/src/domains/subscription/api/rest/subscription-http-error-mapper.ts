import type { HttpException } from '@nestjs/common';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { toHttpErrorPayload } from '~/platform/http/api-error-code';
import {
  BillingWebhookVerificationError,
  isWorkspaceBlockLimitReachedAppError,
  SubscriptionInvalidReturnUrlError,
  SubscriptionAppError,
  SubscriptionPermissionDeniedError,
  SubscriptionWorkspaceNotFoundError,
  type WorkspaceBlockLimitReachedAppError,
} from '../../app/errors/subscription-app.error';

export function isSubscriptionAppError(
  error: unknown,
): error is SubscriptionAppError | WorkspaceBlockLimitReachedAppError {
  return error instanceof SubscriptionAppError || isWorkspaceBlockLimitReachedAppError(error);
}

export function mapSubscriptionAppErrorToHttpException(
  error: SubscriptionAppError | WorkspaceBlockLimitReachedAppError,
): HttpException {
  if (error instanceof SubscriptionWorkspaceNotFoundError) {
    return new NotFoundException(toHttpErrorPayload(error));
  }

  if (
    error instanceof SubscriptionPermissionDeniedError
    || isWorkspaceBlockLimitReachedAppError(error)
  ) {
    return new ForbiddenException({
      ...toHttpErrorPayload(error),
      ...(isWorkspaceBlockLimitReachedAppError(error)
        ? {
          plan: error.metadata.plan,
          block_count: error.metadata.blockCount,
          block_limit: error.metadata.blockLimit,
          upgrade_available: error.metadata.upgradeAvailable,
        }
        : {}),
    });
  }

  if (
    error instanceof BillingWebhookVerificationError
    || error instanceof SubscriptionInvalidReturnUrlError
  ) {
    return new BadRequestException(toHttpErrorPayload(error));
  }

  return new BadRequestException(toHttpErrorPayload(error));
}

export function rethrowSubscriptionAppError(error: unknown): never {
  if (isSubscriptionAppError(error)) {
    throw mapSubscriptionAppErrorToHttpException(error);
  }

  throw error;
}
