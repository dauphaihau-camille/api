import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { UserEntity } from '../../user/infra/persistence/entities/user.entity';
import { WorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/workspace.entity';
import type { DocumentAccessGrantPermission } from '../domain/enums/document-access-grant-permission.enum';
import {
  DocumentAccessSettingRepository,
  type DocumentAccessSettingSummary,
} from '../app/ports/document-access-setting.repository';
import { DocumentAccessSettingEntity } from './persistence/entities/document-access-setting.entity';
import { DocumentEntity } from './persistence/entities/document.entity';

@Injectable()
export class MikroOrmDocumentAccessSettingRepository extends DocumentAccessSettingRepository {
  constructor(private readonly entityManager: EntityManager) {
    super();
  }

  async findByDocumentId(documentId: string): Promise<DocumentAccessSettingSummary | null> {
    const setting = await this.entityManager.fork().findOne(
      DocumentAccessSettingEntity,
      { document: documentId },
      { populate: ['document', 'updatedBy'] },
    );

    return setting ? this.toSummary(setting) : null;
  }

  async findWorkspaceMemberPermissionsByDocumentId(input: {
    documentIds: string[];
  }): Promise<Map<string, DocumentAccessGrantPermission>> {
    if (input.documentIds.length === 0) {
      return new Map();
    }

    const settings = await this.entityManager.fork().find(
      DocumentAccessSettingEntity,
      {
        document: { $in: input.documentIds },
        workspaceMemberPermission: { $ne: null },
      },
      { populate: ['document'] },
    );

    return new Map(settings.flatMap((setting) =>
      setting.workspaceMemberPermission
        ? [[setting.document.id, setting.workspaceMemberPermission] as const]
        : []));
  }

  async upsertWorkspaceMemberPermission(input: {
    workspaceId: string;
    documentId: string;
    permission?: DocumentAccessGrantPermission;
    updatedByUserId: string;
  }): Promise<DocumentAccessSettingSummary> {
    const entityManager = this.entityManager.fork();
    const repository = entityManager.getRepository(DocumentAccessSettingEntity);

    const existingSetting = await repository.findOne(
      { document: input.documentId },
      { populate: ['document', 'updatedBy'] },
    );

    const setting = existingSetting ??
      repository.create({
        workspace: entityManager.getReference(WorkspaceEntity, input.workspaceId),
        document: entityManager.getReference(DocumentEntity, input.documentId),
        updatedBy: entityManager.getReference(UserEntity, input.updatedByUserId),
      });

    setting.workspaceMemberPermission = input.permission;
    setting.updatedBy = entityManager.getReference(UserEntity, input.updatedByUserId);

    await entityManager.persist(setting).flush();
    await entityManager.populate(setting, ['document', 'updatedBy']);

    return this.toSummary(setting);
  }

  private toSummary(setting: DocumentAccessSettingEntity): DocumentAccessSettingSummary {
    return {
      documentId: setting.document.id,
      workspaceMemberPermission: setting.workspaceMemberPermission,
      updatedByUserId: setting.updatedBy.id,
      createdAt: setting.createdAt,
      updatedAt: setting.updatedAt,
    };
  }
}
