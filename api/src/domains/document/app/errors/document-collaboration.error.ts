export class DocumentCollaborationNotFoundError extends Error {
  readonly code = 'DOCUMENT_COLLABORATION_NOT_FOUND';

  constructor(documentId: string) {
    super(`Document ${documentId} was not found`);
  }
}

export class DocumentCollaborationPermissionDeniedError extends Error {
  readonly code = 'DOCUMENT_COLLABORATION_PERMISSION_DENIED';

  constructor() {
    super('You do not have permission to edit this document');
  }
}

export class InvalidDocumentCollaborationUpdateError extends Error {
  readonly code = 'INVALID_DOCUMENT_COLLABORATION_UPDATE';

  constructor() {
    super('The document collaboration update is invalid');
  }
}
