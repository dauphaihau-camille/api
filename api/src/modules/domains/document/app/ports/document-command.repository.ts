import type { CurrentUserEntity } from "../../../auth/infra/persistence/entities/current-user.entity";
import type { TeamspaceEntity } from "../../../teamspace/infra/persistence/entities/teamspace.entity";
import type { DocumentSubdocReferenceRepository } from "./document-subdoc-reference.repository";
import type { DocumentEntity } from "../../infra/persistence/entities/document.entity";

export type DocumentCommandTransaction = {
  commandRepository: DocumentCommandRepository;
  subdocReferenceRepository: DocumentSubdocReferenceRepository;
};

export abstract class DocumentCommandRepository {
  abstract findDocument(
    documentIdentifier: string,
  ): Promise<DocumentEntity | null>;
  abstract findCurrentUser(userId: string): Promise<CurrentUserEntity>;
  abstract findTeamspaceByIdInWorkspace(
    teamspaceId: string,
    workspaceId: string,
  ): Promise<TeamspaceEntity | null>;
  abstract createDocument(payload: Record<string, unknown>): DocumentEntity;
  abstract saveDocument(document: DocumentEntity): Promise<void>;
  abstract saveDocuments(documents: DocumentEntity[]): Promise<void>;
  abstract flush(): Promise<void>;
  abstract lockDocumentVersion(
    document: DocumentEntity,
    version: number,
  ): Promise<void>;
  abstract withTransaction<T>(
    callback: (repositories: DocumentCommandTransaction) => Promise<T>,
  ): Promise<T>;
}
