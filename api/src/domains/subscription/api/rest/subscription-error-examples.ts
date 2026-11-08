import type { ApiErrorExample } from '~/platform/http/api-error-responses.decorator';

/**
 * Subscription and billing-domain error payloads for the
 * `@ApiErrorResponses` decorator.
 *
 * The `code` and `message` mirror what the subscription HTTP error mapper emits
 * at runtime; the `error` label is only the example name so several failures
 * of the same status can coexist on one operation.
 */
export const subscriptionWorkspaceNotFoundErrorExample: ApiErrorExample = {
  code: 'SUBSCRIPTION_WORKSPACE_NOT_FOUND',
  error: 'Subscription Workspace Not Found',
  message: 'Workspace workspace_123 was not found.',
};

export const subscriptionInvalidReturnUrlErrorExample: ApiErrorExample = {
  code: 'SUBSCRIPTION_INVALID_RETURN_URL',
  error: 'Subscription Invalid Return Url',
  message: 'Checkout return URL is invalid.',
};

export const billingWebhookVerificationErrorExample: ApiErrorExample = {
  code: 'BILLING_WEBHOOK_VERIFICATION',
  error: 'Billing Webhook Verification',
  message: 'Billing webhook could not be verified.',
};
