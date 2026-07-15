export abstract class FavoriteAppError extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class FavoriteDocumentNotFoundError extends FavoriteAppError {
  constructor(documentId: string) {
    super(`Document ${documentId} was not found.`);
  }
}

export class FavoriteWorkspaceNotFoundError extends FavoriteAppError {
  constructor(workspaceIdentifier: string) {
    super(`Workspace ${workspaceIdentifier} was not found.`);
  }
}
