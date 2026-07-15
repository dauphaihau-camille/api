export type ProvisionDefaultWorkspaceDocumentInput = {
  workspaceId: string;
  ownerUserId: string;
};

export abstract class WorkspaceDefaultDocumentProvisioner {
  abstract provisionDefaultDocument(
    input: ProvisionDefaultWorkspaceDocumentInput,
  ): Promise<{ documentId: string }>;
}
