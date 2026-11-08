import type { ApiErrorExample } from '~/platform/http/api-error-responses.decorator';

/**
 * AI assistance-domain error payloads for the `@ApiErrorResponses` decorator.
 *
 * The `code` and `message` mirror what the AI assistance HTTP error mapper
 * emits at runtime; the `error` label is only the example name so several
 * failures of the same status can coexist on one operation.
 */
export const aiWorkspaceNotFoundErrorExample: ApiErrorExample = {
  code: 'AI_WORKSPACE_NOT_FOUND',
  error: 'AI Workspace Not Found',
  message: 'Workspace not found',
};

export const aiConversationSessionNotFoundErrorExample: ApiErrorExample = {
  code: 'AI_CONVERSATION_SESSION_NOT_FOUND',
  error: 'AI Conversation Session Not Found',
  message: 'AI conversation session not found',
};

export const aiResponseLimitReachedErrorExample: ApiErrorExample = {
  code: 'AI_RESPONSE_LIMIT_REACHED',
  error: 'AI Response Limit Reached',
  message: 'Workspace AI trial responses are exhausted',
};
