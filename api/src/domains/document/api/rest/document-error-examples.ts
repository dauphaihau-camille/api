import type { ApiErrorExample } from '~/platform/http/api-error-responses.decorator';

/**
 * Document-domain error payloads for the `@ApiErrorResponses` decorator.
 *
 * The `code` and `message` mirror what the document HTTP error mapper emits at
 * runtime; the example is keyed by its `code` so several failures of
 * the same status can coexist on one operation.
 */
export const documentNotFoundErrorExample: ApiErrorExample = {
  code: 'DOCUMENT_NOT_FOUND',
  message: 'Document document_123 was not found.',
};

export const documentWorkspaceNotFoundErrorExample: ApiErrorExample = {
  code: 'DOCUMENT_WORKSPACE_NOT_FOUND',
  message: 'Workspace workspace_123 was not found.',
};

export const documentTeamspaceNotFoundErrorExample: ApiErrorExample = {
  code: 'DOCUMENT_TEAMSPACE_NOT_FOUND',
  message: 'Teamspace teamspace_123 was not found.',
};

export const documentPermissionDeniedErrorExample: ApiErrorExample = {
  code: 'DOCUMENT_PERMISSION_DENIED',
  message: 'You do not have permission to update this workspace.',
};

export const documentVersionConflictErrorExample: ApiErrorExample = {
  code: 'DOCUMENT_VERSION_CONFLICT',
  message: 'Document version conflict.',
};

export const documentContentManagedByCollaborationErrorExample: ApiErrorExample = {
  code: 'DOCUMENT_CONTENT_MANAGED_BY_COLLABORATION',
  message: 'Document content must be updated through the collaboration channel.',
};

export const documentNotArchivedErrorExample: ApiErrorExample = {
  code: 'DOCUMENT_NOT_ARCHIVED',
  message: 'Document must be in trash before it can be permanently deleted.',
};

export const documentInvitationNotFoundErrorExample: ApiErrorExample = {
  code: 'DOCUMENT_INVITATION_NOT_FOUND',
  message: 'Document invitation invitation_123 was not found.',
};

export const documentAccessGrantUserNotFoundErrorExample: ApiErrorExample = {
  code: 'DOCUMENT_ACCESS_GRANT_USER_NOT_FOUND',
  message: 'User user_123 was not found.',
};

export const documentShareRecipientRequiredErrorExample: ApiErrorExample = {
  code: 'DOCUMENT_SHARE_RECIPIENT_REQUIRED',
  message: 'Document share recipient is required.',
};

export const archivedDocumentDuplicationErrorExample: ApiErrorExample = {
  code: 'ARCHIVED_DOCUMENT_DUPLICATION',
  message: 'Archived document cannot be duplicated.',
};

export const invalidDocumentCursorErrorExample: ApiErrorExample = {
  code: 'INVALID_DOCUMENT_CURSOR',
  message: 'Invalid document cursor.',
};

export const documentDescendantMoveErrorExample: ApiErrorExample = {
  code: 'DOCUMENT_DESCENDANT_MOVE',
  message: 'Document cannot be moved into one of its descendants.',
};

export const parentDocumentWorkspaceMismatchErrorExample: ApiErrorExample = {
  code: 'PARENT_DOCUMENT_WORKSPACE_MISMATCH',
  message: 'Parent document does not belong to the selected workspace.',
};

export const workspaceBlockLimitReachedErrorExample: ApiErrorExample = {
  code: 'WORKSPACE_BLOCK_LIMIT_REACHED',
  message: 'Workspace block limit reached.',
};
