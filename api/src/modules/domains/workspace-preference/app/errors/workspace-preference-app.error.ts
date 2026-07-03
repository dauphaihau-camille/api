export abstract class WorkspacePreferenceAppError extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class WorkspacePreferenceWorkspaceNotFoundError extends WorkspacePreferenceAppError {
  constructor(workspaceIdentifier: string) {
    super(`Workspace ${workspaceIdentifier} was not found.`);
  }
}
