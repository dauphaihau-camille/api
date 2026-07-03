import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { CurrentUserEntity } from '../../auth/infra/persistence/entities/current-user.entity';
import { DocumentEntity } from '../../document/infra/persistence/entities/document.entity';
import { PublishRepository } from '../app/ports/publish.repository';
import { PublishedDocumentEntity } from './persistence/entities/published-document.entity';

@Injectable()
export class MikroOrmPublishRepository implements PublishRepository {
  constructor(private readonly entityManager: EntityManager) {}

  async findDocument(documentId: string): Promise<DocumentEntity | null> {
    return this.entityManager.fork().findOne(DocumentEntity, { id: documentId }, {
      populate: ['workspace'],
    });
  }

  async findPublishedDocumentByDocumentId(
    documentId: string,
  ): Promise<PublishedDocumentEntity | null> {
    return this.entityManager.fork().findOne(PublishedDocumentEntity, {
      document: documentId,
    });
  }

  async findPublishedDocumentById(
    publishedDocumentId: string,
  ): Promise<PublishedDocumentEntity | null> {
    return this.entityManager.fork().findOne(PublishedDocumentEntity, {
      id: publishedDocumentId,
    }, {
      populate: ['document'],
    });
  }

  async publishDocument(
    document: DocumentEntity,
    userId: string,
  ): Promise<{ publishedDocument: PublishedDocumentEntity; created: boolean }> {
    const entityManager = this.entityManager.fork();
    const existingPublishedDocument = await entityManager.findOne(PublishedDocumentEntity, {
      document: document.id,
    });

    if (existingPublishedDocument) {
      return {
        publishedDocument: existingPublishedDocument,
        created: false,
      };
    }

    const actor = await entityManager.findOneOrFail(CurrentUserEntity, { id: userId });
    const publishedDocument = entityManager.create(PublishedDocumentEntity, {
      workspace: document.workspace,
      document,
      publishedBy: actor,
    });

    await entityManager.persist(publishedDocument).flush();

    return {
      publishedDocument,
      created: true,
    };
  }

  async unpublishDocument(documentId: string): Promise<PublishedDocumentEntity | null> {
    const entityManager = this.entityManager.fork();
    const publishedDocument = await entityManager.findOne(PublishedDocumentEntity, {
      document: documentId,
    });

    if (!publishedDocument) {
      return null;
    }

    await entityManager.remove(publishedDocument).flush();

    return publishedDocument;
  }
}
