import type { EntityManager } from '@mikro-orm/postgresql';

export type ProvisionDefaultWorkspaceDocumentInput = {
  entityManager: EntityManager;
  workspaceId: string;
  ownerUserId: string;
};

export abstract class WorkspaceDefaultDocumentProvisioner {
  abstract provisionDefaultDocument(
    input: ProvisionDefaultWorkspaceDocumentInput,
  ): Promise<{ documentId: string }>;
}
