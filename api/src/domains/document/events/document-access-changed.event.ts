export class DocumentAccessChangedEvent {
  constructor(
    public readonly documentId: string,
    public readonly workspaceId: string,
  ) {}
}
