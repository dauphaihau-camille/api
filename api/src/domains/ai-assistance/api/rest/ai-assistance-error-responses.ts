import type { ApiErrorExample } from '~/platform/http/api-error-responses.decorator';

/**
 * AI assistance-domain error payloads for the `@ApiErrorResponses` decorator.
 *
 * The `code` and `message` mirror what the AI assistance HTTP error mapper
 * emits at runtime; the example is keyed by its `code` so several
 * failures of the same status can coexist on one operation.
 */
export const aiWorkspaceNotFoundErrorExample: ApiErrorExample = {
  code: 'AI_WORKSPACE_NOT_FOUND',
  message: 'Workspace not found',
};

export const aiConversationSessionNotFoundErrorExample: ApiErrorExample = {
  code: 'AI_CONVERSATION_SESSION_NOT_FOUND',
  message: 'AI conversation session not found',
};

export const aiResponseLimitReachedErrorExample: ApiErrorExample = {
  code: 'AI_RESPONSE_LIMIT_REACHED',
  message: 'Workspace AI trial responses are exhausted',
};
