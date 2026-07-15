export abstract class PublishAppError extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class PublishDocumentNotFoundError extends PublishAppError {
  constructor(documentId: string) {
    super(`Document ${documentId} was not found.`);
  }
}

export class PublishWorkspaceNotFoundError extends PublishAppError {
  constructor(workspaceIdentifier: string) {
    super(`Workspace ${workspaceIdentifier} was not found.`);
  }
}

export class PublishedDocumentNotFoundError extends PublishAppError {
  constructor(publishedDocumentId: string) {
    super(`Published document ${publishedDocumentId} was not found.`);
  }
}

export class PublishPermissionDeniedError extends PublishAppError {
  constructor(message = 'You do not have permission to update this workspace.') {
    super(message);
  }
}

export class ArchivedDocumentPublicAccessDeniedError extends PublishAppError {
  constructor() {
    super('Archived documents cannot be viewed publicly.');
  }
}
