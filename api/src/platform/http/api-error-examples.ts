import type { ApiErrorExample } from '~/platform/http/api-error-responses.decorator';

/**
 * Reusable public error example payloads for the `@ApiErrorResponses`
 * decorator.
 *
 * Controllers keep the response statuses and select the examples that actually
 * apply; this module only owns the shared, exact payload shapes so the same
 * failure is documented identically everywhere. It never declares a status.
 *
 * Every example carries the stable `code` the envelope emits, so consumers can
 * key on it instead of the human-readable `message`.
 */
export const validationErrorExample: ApiErrorExample = {
  code: 'BAD_REQUEST',
  error: 'Bad Request',
  message: ['email must be an email'],
};

export const unauthorizedErrorExample: ApiErrorExample = {
  code: 'UNAUTHORIZED',
  error: 'Unauthorized',
  message: 'Unauthorized',
};

export const forbiddenErrorExample: ApiErrorExample = {
  code: 'FORBIDDEN',
  error: 'Forbidden',
  message: 'Missing required permissions',
};

export const notFoundErrorExample: ApiErrorExample = {
  code: 'NOT_FOUND',
  error: 'Not Found',
  message: 'Resource not found',
};

export const conflictErrorExample: ApiErrorExample = {
  code: 'CONFLICT',
  error: 'Conflict',
  message: 'Resource already exists',
};

export const internalServerErrorExample: ApiErrorExample = {
  code: 'INTERNAL_SERVER_ERROR',
  error: 'Internal Server Error',
  message: 'Internal server error',
};

export const tooManyRequestsErrorExample: ApiErrorExample = {
  code: 'TOO_MANY_REQUESTS',
  error: 'Too Many Requests',
  message: 'Too many requests.',
};

/**
 * Domain-level examples.
 *
 * The `code` and `message` here mirror what the `*-http-error-mapper.ts`
 * adapters emit at runtime; the `error` label is only the example name so
 * several failures of the same status can coexist on one operation.
 */

export const documentNotFoundErrorExample: ApiErrorExample = {
  code: 'DOCUMENT_NOT_FOUND',
  error: 'Document Not Found',
  message: 'Document document_123 was not found.',
};

export const documentWorkspaceNotFoundErrorExample: ApiErrorExample = {
  code: 'DOCUMENT_WORKSPACE_NOT_FOUND',
  error: 'Document Workspace Not Found',
  message: 'Workspace workspace_123 was not found.',
};

export const documentTeamspaceNotFoundErrorExample: ApiErrorExample = {
  code: 'DOCUMENT_TEAMSPACE_NOT_FOUND',
  error: 'Document Teamspace Not Found',
  message: 'Teamspace teamspace_123 was not found.',
};

export const documentPermissionDeniedErrorExample: ApiErrorExample = {
  code: 'DOCUMENT_PERMISSION_DENIED',
  error: 'Document Permission Denied',
  message: 'You do not have permission to update this workspace.',
};

export const documentVersionConflictErrorExample: ApiErrorExample = {
  code: 'DOCUMENT_VERSION_CONFLICT',
  error: 'Document Version Conflict',
  message: 'Document version conflict.',
};

export const documentContentManagedByCollaborationErrorExample: ApiErrorExample = {
  code: 'DOCUMENT_CONTENT_MANAGED_BY_COLLABORATION',
  error: 'Document Content Managed By Collaboration',
  message: 'Document content must be updated through the collaboration channel.',
};

export const documentNotArchivedErrorExample: ApiErrorExample = {
  code: 'DOCUMENT_NOT_ARCHIVED',
  error: 'Document Not Archived',
  message: 'Document must be in trash before it can be permanently deleted.',
};

export const documentInvitationNotFoundErrorExample: ApiErrorExample = {
  code: 'DOCUMENT_INVITATION_NOT_FOUND',
  error: 'Document Invitation Not Found',
  message: 'Document invitation invitation_123 was not found.',
};

export const documentAccessGrantUserNotFoundErrorExample: ApiErrorExample = {
  code: 'DOCUMENT_ACCESS_GRANT_USER_NOT_FOUND',
  error: 'Document Access Grant User Not Found',
  message: 'User user_123 was not found.',
};

export const documentShareRecipientRequiredErrorExample: ApiErrorExample = {
  code: 'DOCUMENT_SHARE_RECIPIENT_REQUIRED',
  error: 'Document Share Recipient Required',
  message: 'Document share recipient is required.',
};

export const archivedDocumentDuplicationErrorExample: ApiErrorExample = {
  code: 'ARCHIVED_DOCUMENT_DUPLICATION',
  error: 'Archived Document Duplication',
  message: 'Archived document cannot be duplicated.',
};

export const invalidDocumentCursorErrorExample: ApiErrorExample = {
  code: 'INVALID_DOCUMENT_CURSOR',
  error: 'Invalid Document Cursor',
  message: 'Invalid document cursor.',
};

export const documentDescendantMoveErrorExample: ApiErrorExample = {
  code: 'DOCUMENT_DESCENDANT_MOVE',
  error: 'Document Descendant Move',
  message: 'Document cannot be moved into one of its descendants.',
};

export const parentDocumentWorkspaceMismatchErrorExample: ApiErrorExample = {
  code: 'PARENT_DOCUMENT_WORKSPACE_MISMATCH',
  error: 'Parent Document Workspace Mismatch',
  message: 'Parent document does not belong to the selected workspace.',
};

export const workspaceBlockLimitReachedErrorExample: ApiErrorExample = {
  code: 'WORKSPACE_BLOCK_LIMIT_REACHED',
  error: 'Workspace Block Limit Reached',
  message: 'Workspace block limit reached.',
};

export const workspaceNotFoundErrorExample: ApiErrorExample = {
  code: 'WORKSPACE_NOT_FOUND',
  error: 'Workspace Not Found',
  message: 'Workspace workspace_123 was not found.',
};

export const workspacePermissionDeniedErrorExample: ApiErrorExample = {
  code: 'WORKSPACE_PERMISSION_DENIED',
  error: 'Workspace Permission Denied',
  message: 'You do not have permission to update this workspace.',
};

export const workspaceVersionConflictErrorExample: ApiErrorExample = {
  code: 'WORKSPACE_VERSION_CONFLICT_APP',
  error: 'Workspace Version Conflict',
  message: 'Workspace version conflict.',
};

export const workspaceSlugInUseErrorExample: ApiErrorExample = {
  code: 'WORKSPACE_SLUG_IN_USE',
  error: 'Workspace Slug In Use',
  message: 'Workspace domain is already in use.',
};

export const workspaceSlugReservedErrorExample: ApiErrorExample = {
  code: 'WORKSPACE_SLUG_RESERVED',
  error: 'Workspace Slug Reserved',
  message: 'Workspace domain is reserved.',
};

export const workspaceSlugLengthErrorExample: ApiErrorExample = {
  code: 'WORKSPACE_SLUG_LENGTH',
  error: 'Workspace Slug Length',
  message: 'Workspace domain must be 3 to 32 characters.',
};

export const workspaceSlugInvalidErrorExample: ApiErrorExample = {
  code: 'WORKSPACE_SLUG_INVALID',
  error: 'Workspace Slug Invalid',
  message: 'Workspace domain is invalid.',
};

export const workspaceDeletePermissionDeniedErrorExample: ApiErrorExample = {
  code: 'WORKSPACE_DELETE_PERMISSION_DENIED',
  error: 'Workspace Delete Permission Denied',
  message: 'Only workspace owners can delete this workspace.',
};

export const teamspaceNotFoundErrorExample: ApiErrorExample = {
  code: 'TEAMSPACE_NOT_FOUND',
  error: 'Teamspace Not Found',
  message: 'Teamspace teamspace_123 was not found.',
};

export const teamspaceWorkspaceNotFoundErrorExample: ApiErrorExample = {
  code: 'TEAMSPACE_WORKSPACE_NOT_FOUND',
  error: 'Teamspace Workspace Not Found',
  message: 'Workspace workspace_123 was not found.',
};

export const teamspaceNameTooShortErrorExample: ApiErrorExample = {
  code: 'TEAMSPACE_NAME_TOO_SHORT',
  error: 'Teamspace Name Too Short',
  message: 'Teamspace name must be at least 2 characters.',
};

export const teamspacePermissionDeniedErrorExample: ApiErrorExample = {
  code: 'TEAMSPACE_PERMISSION_DENIED',
  error: 'Teamspace Permission Denied',
  message: 'You do not have permission to update this workspace.',
};

export const teamspaceVersionConflictErrorExample: ApiErrorExample = {
  code: 'TEAMSPACE_VERSION_CONFLICT',
  error: 'Teamspace Version Conflict',
  message: 'Teamspace version conflict.',
};

export const membershipNotFoundErrorExample: ApiErrorExample = {
  code: 'MEMBERSHIP_NOT_FOUND',
  error: 'Membership Not Found',
  message: 'Workspace member was not found.',
};

export const membershipWorkspaceNotFoundErrorExample: ApiErrorExample = {
  code: 'MEMBERSHIP_WORKSPACE_NOT_FOUND',
  error: 'Membership Workspace Not Found',
  message: 'Workspace workspace_123 was not found.',
};

export const membershipUserNotFoundErrorExample: ApiErrorExample = {
  code: 'MEMBERSHIP_USER_NOT_FOUND',
  error: 'Membership User Not Found',
  message: 'User user@example.com was not found.',
};

export const membershipAlreadyExistsErrorExample: ApiErrorExample = {
  code: 'MEMBERSHIP_ALREADY_EXISTS',
  error: 'Membership Already Exists',
  message: 'That user is already a workspace member.',
};

export const membershipVersionConflictErrorExample: ApiErrorExample = {
  code: 'MEMBERSHIP_VERSION_CONFLICT',
  error: 'Membership Version Conflict',
  message: 'Workspace member version conflict.',
};

export const membershipLastOwnerConflictErrorExample: ApiErrorExample = {
  code: 'MEMBERSHIP_LAST_OWNER_CONFLICT',
  error: 'Membership Last Owner Conflict',
  message: 'Workspace must keep at least one owner.',
};

export const publishedDocumentNotFoundErrorExample: ApiErrorExample = {
  code: 'PUBLISHED_DOCUMENT_NOT_FOUND',
  error: 'Published Document Not Found',
  message: 'Published document published_document_123 was not found.',
};

export const publishDocumentNotFoundErrorExample: ApiErrorExample = {
  code: 'PUBLISH_DOCUMENT_NOT_FOUND',
  error: 'Publish Document Not Found',
  message: 'Document document_123 was not found.',
};

export const publishPermissionDeniedErrorExample: ApiErrorExample = {
  code: 'PUBLISH_PERMISSION_DENIED',
  error: 'Publish Permission Denied',
  message: 'You do not have permission to publish this document.',
};

export const searchWorkspaceNotFoundErrorExample: ApiErrorExample = {
  code: 'SEARCH_WORKSPACE_NOT_FOUND',
  error: 'Search Workspace Not Found',
  message: 'Workspace workspace_123 was not found.',
};

export const favoriteDocumentNotFoundErrorExample: ApiErrorExample = {
  code: 'FAVORITE_DOCUMENT_NOT_FOUND',
  error: 'Favorite Document Not Found',
  message: 'Document document_123 was not found.',
};

export const favoriteWorkspaceNotFoundErrorExample: ApiErrorExample = {
  code: 'FAVORITE_WORKSPACE_NOT_FOUND',
  error: 'Favorite Workspace Not Found',
  message: 'Workspace workspace_123 was not found.',
};

export const workspacePreferenceWorkspaceNotFoundErrorExample: ApiErrorExample = {
  code: 'WORKSPACE_PREFERENCE_WORKSPACE_NOT_FOUND',
  error: 'Workspace Preference Workspace Not Found',
  message: 'Workspace workspace_123 was not found.',
};

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

export const userNotFoundErrorExample: ApiErrorExample = {
  code: 'USER_NOT_FOUND',
  error: 'User Not Found',
  message: 'User was not found',
};

export const userEmailAlreadyRegisteredErrorExample: ApiErrorExample = {
  code: 'USER_EMAIL_ALREADY_REGISTERED',
  error: 'User Email Already Registered',
  message: 'Email is already registered',
};

export const userVersionConflictErrorExample: ApiErrorExample = {
  code: 'USER_VERSION_CONFLICT',
  error: 'User Version Conflict',
  message: 'User was updated by another request. Refresh and retry with the latest version.',
};

export const actorNotAllowedToCreateUsersErrorExample: ApiErrorExample = {
  code: 'ACTOR_NOT_ALLOWED_TO_CREATE_USERS',
  error: 'Actor Not Allowed To Create Users',
  message: 'Only admins can create users',
};

export const actorNotAllowedToUpdateUsersErrorExample: ApiErrorExample = {
  code: 'ACTOR_NOT_ALLOWED_TO_UPDATE_USERS',
  error: 'Actor Not Allowed To Update Users',
  message: 'Only admins can update users',
};

export const invalidCredentialsErrorExample: ApiErrorExample = {
  code: 'INVALID_CREDENTIALS',
  error: 'Invalid Credentials',
  message: 'Invalid email or password',
};

export const invalidRefreshTokenErrorExample: ApiErrorExample = {
  code: 'INVALID_REFRESH_TOKEN',
  error: 'Invalid Refresh Token',
  message: 'Invalid refresh token',
};

export const refreshSessionNotFoundErrorExample: ApiErrorExample = {
  code: 'REFRESH_SESSION_NOT_FOUND',
  error: 'Refresh Session Not Found',
  message: 'Refresh session was not found',
};

export const emailAlreadyRegisteredErrorExample: ApiErrorExample = {
  code: 'EMAIL_ALREADY_REGISTERED',
  error: 'Email Already Registered',
  message: 'Email is already registered',
};

export const emailAuthAccountNotFoundErrorExample: ApiErrorExample = {
  code: 'EMAIL_AUTH_ACCOUNT_NOT_FOUND',
  error: 'Email Auth Account Not Found',
  message: 'No account found for this email',
};

export const sessionNotActiveErrorExample: ApiErrorExample = {
  code: 'SESSION_NOT_ACTIVE',
  error: 'Session Not Active',
  message: 'Session is not active',
};

export const inactiveUserErrorExample: ApiErrorExample = {
  code: 'INACTIVE_USER',
  error: 'Inactive User',
  message: 'User account is not active',
};

export const invalidEmailLoginCodeErrorExample: ApiErrorExample = {
  code: 'INVALID_EMAIL_LOGIN_CODE',
  error: 'Invalid Email Login Code',
  message: 'Invalid login code',
};
