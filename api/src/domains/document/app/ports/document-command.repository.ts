import type { DocumentSubdocReferenceRepository } from './document-subdoc-reference.repository';
import type { DocumentCollaborationRepository } from './document-collaboration.repository';
import type { DocumentEntity } from '../../infra/persistence/entities/document.entity';
import type { DocumentTeamspaceRef } from '../contracts/document.contract';

export type CreateDocumentRecordInput = {
  workspaceId: string;
  teamspaceId?: string;
  parentDocumentId?: string;
  title: string;
  contentFormat: string;
  contentJson: unknown[];
  searchText: string;
  sortKey: number;
  createdByUserId: string;
  ownerUserId: string;
  updatedByUserId: string;
};

export type DocumentCommandTransaction = {
  commandRepository: DocumentCommandRepository;
  collaborationRepository: DocumentCollaborationRepository;
  subdocReferenceRepository: DocumentSubdocReferenceRepository;
};

export abstract class DocumentCommandRepository {
  abstract findDocument(
    documentIdentifier: string,
  ): Promise<DocumentEntity | null>;
  abstract findTeamspaceByIdInWorkspace(
    teamspaceId: string,
    workspaceId: string,
  ): Promise<DocumentTeamspaceRef | null>;
  abstract createDocument(input: CreateDocumentRecordInput): DocumentEntity;
  abstract assignUpdatedByUser(document: DocumentEntity, userId: string): void;
  abstract saveDocument(document: DocumentEntity): Promise<void>;
  abstract saveDocuments(documents: DocumentEntity[]): Promise<void>;
  abstract removeDocuments(documents: DocumentEntity[]): Promise<void>;
  abstract flush(): Promise<void>;
  abstract lockDocumentVersion(
    document: DocumentEntity,
    version: number,
  ): Promise<void>;
  abstract withTransaction<T>(
    callback: (repositories: DocumentCommandTransaction) => Promise<T>,
  ): Promise<T>;
}
