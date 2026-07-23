import { MikroOrmModule } from '@mikro-orm/nestjs';
import { forwardRef, Module } from '@nestjs/common';
import { CurrentUserEntity } from '../auth/infra/persistence/entities/current-user.entity';
import { AuditModule } from '../../integrations/audit/audit.module';
import { ObservabilityModule } from '../../platform/observability/observability.module';
import { WsModule } from '../../platform/ws/ws.module';
import { QueueModule } from '../../integrations/queue/queue.module';
import { PublishRepository } from '../publish/app/ports/publish.repository';
import { MikroOrmPublishRepository } from '../publish/infra/mikro-orm-publish.repository';
import { PublishedDocumentEntity } from '../publish/infra/persistence/entities/published-document.entity';
import { WorkspaceDefaultDocumentProvisioner } from '../workspace/app/ports/workspace-default-document-provisioner';
import { WorkspaceModule } from '../workspace/workspace.module';
import { WorkspaceMemberEntity } from '../workspace/infra/persistence/entities/workspace-member.entity';
import { TeamspaceMemberEntity } from '../teamspace/infra/persistence/entities/teamspace-member.entity';
import { TeamspaceEntity } from '../teamspace/infra/persistence/entities/teamspace.entity';
import { WorkspaceEntity } from '../workspace/infra/persistence/entities/workspace.entity';
import { DocumentController } from './api/rest/document.controller';
import { DocumentAccessGrantRepository } from './app/ports/document-access-grant.repository';
import { DocumentAccessSettingRepository } from './app/ports/document-access-setting.repository';
import { DocumentCommandRepository } from './app/ports/document-command.repository';
import { DocumentNavigationQueryRepository } from './app/ports/document-navigation-query.repository';
import { DocumentSubdocReferenceRepository } from './app/ports/document-subdoc-reference.repository';
import { DocumentTreeQueryRepository } from './app/ports/document-tree-query.repository';
import { DocumentVisitRepository } from './app/ports/document-visit.repository';
import { ArchiveDocumentUseCase } from './app/use-cases/archive-document.use-case';
import { ArchiveSubdocCommandUseCase } from './app/use-cases/archive-subdoc-command.use-case';
import { CreateDocumentUseCase } from './app/use-cases/create-document.use-case';
import { CreateSubdocCommandUseCase } from './app/use-cases/create-subdoc-command.use-case';
import { DocumentSubdocContentService } from './app/services/document-subdoc-content.service';
import { DocumentTreeService } from './app/services/document-tree.service';
import { DocumentAccessCapabilityService } from './app/services/document-access-capability.service';
import { DuplicateDocumentUseCase } from './app/use-cases/duplicate-document.use-case';
import { GetDefaultWorkspaceDocumentUseCase } from './app/use-cases/get-default-workspace-document.use-case';
import { GetDocumentUseCase } from './app/use-cases/get-document.use-case';
import { GetDocumentAccessSettingsUseCase } from './app/use-cases/get-document-access-settings.use-case';
import { ListDocumentChildrenUseCase } from './app/use-cases/list-document-children.use-case';
import { ListArchivedWorkspaceDocumentsUseCase } from './app/use-cases/list-archived-workspace-documents.use-case';
import { ListDocumentCollaboratorsUseCase } from './app/use-cases/list-document-collaborators.use-case';
import { ListWorkspaceDocumentsUseCase } from './app/use-cases/list-workspace-documents.use-case';
import { MoveDocumentUseCase } from './app/use-cases/move-document.use-case';
import { PermanentlyDeleteDocumentUseCase } from './app/use-cases/permanently-delete-document.use-case';
import { RevokeDocumentAccessUseCase } from './app/use-cases/revoke-document-access.use-case';
import { RestoreDocumentUseCase } from './app/use-cases/restore-document.use-case';
import { RemoveArchivedSubdocReferencesUseCase } from './app/use-cases/remove-archived-subdoc-references.use-case';
import { ShareDocumentUseCase } from './app/use-cases/share-document.use-case';
import { SyncDocumentSubdocReferencesUseCase } from './app/use-cases/sync-document-subdoc-references.use-case';
import { SyncReferencedSubdocTitlesUseCase } from './app/use-cases/sync-referenced-subdoc-titles.use-case';
import { UpdateDocumentUseCase } from './app/use-cases/update-document.use-case';
import { UpdateDocumentAccessSettingsUseCase } from './app/use-cases/update-document-access-settings.use-case';
import { MikroOrmDocumentAccessGrantRepository } from './infra/mikro-orm-document-access-grant.repository';
import { MikroOrmDocumentAccessSettingRepository } from './infra/mikro-orm-document-access-setting.repository';
import { MikroOrmDocumentCommandRepository } from './infra/mikro-orm-document-command.repository';
import { MikroOrmDocumentNavigationQueryRepository } from './infra/mikro-orm-document-navigation-query.repository';
import { MikroOrmDocumentSubdocReferenceRepository } from './infra/mikro-orm-document-subdoc-reference.repository';
import { MikroOrmDocumentTreeQueryRepository } from './infra/mikro-orm-document-tree-query.repository';
import { MikroOrmDocumentVisitRepository } from './infra/mikro-orm-document-visit.repository';
import { WorkspaceDefaultDocumentProvisionerService } from './app/services/workspace-default-document-provisioner.service';
import { DocumentObservabilityService } from './observability/document-observability.service';
import { DocumentAccessGrantEntity } from './infra/persistence/entities/document-access-grant.entity';
import { DocumentAccessSettingEntity } from './infra/persistence/entities/document-access-setting.entity';
import { DocumentEntity } from './infra/persistence/entities/document.entity';
import { DocumentSubdocReferenceEntity } from './infra/persistence/entities/document-subdoc-reference.entity';
import { DocumentVisitEntity } from './infra/persistence/entities/document-visit.entity';
import { DocumentFavoriteEntity } from '../favorite/infra/persistence/entities/document-favorite.entity';
import { DocumentCollaborationGateway } from './api/ws/document-collaboration.gateway';
import { DocumentCollaborationProjector } from './app/ports/document-collaboration-projector';
import { DocumentCollaborationRepository } from './app/ports/document-collaboration.repository';
import { DocumentCollaborationTransactionRunner } from './app/ports/document-collaboration-transaction-runner';
import { DocumentBlockNoteProjectorService } from './app/services/document-blocknote-projector.service';
import { DocumentCollaborationReferenceSyncService } from './app/services/document-collaboration-reference-sync.service';
import { DocumentCollaborationService } from './app/services/document-collaboration.service';
import { DocumentSubdocReferenceSyncService } from './app/services/document-subdoc-reference-sync.service';
import { MikroOrmDocumentCollaborationRepository } from './infra/mikro-orm-document-collaboration.repository';
import { MikroOrmDocumentCollaborationTransactionRunner } from './infra/mikro-orm-document-collaboration-transaction.runner';
import { DocumentCollaborationSnapshotEntity } from './infra/persistence/entities/document-collaboration-snapshot.entity';
import { DocumentCollaborationUpdateEntity } from './infra/persistence/entities/document-collaboration-update.entity';
import { DocumentAccessResolver } from './app/policies/document-access.resolver';
import { NotifyCollaborationPermissionsChangedListener } from './listeners/notify-collaboration-permissions-changed.listener';

@Module({
  imports: [
    AuditModule,
    ObservabilityModule,
    QueueModule,
    WsModule,
    forwardRef(() => WorkspaceModule),
    MikroOrmModule.forFeature([
      CurrentUserEntity,
      WorkspaceEntity,
      WorkspaceMemberEntity,
      TeamspaceEntity,
      TeamspaceMemberEntity,
      DocumentEntity,
      DocumentAccessGrantEntity,
      DocumentAccessSettingEntity,
      DocumentSubdocReferenceEntity,
      DocumentVisitEntity,
      DocumentFavoriteEntity,
      PublishedDocumentEntity,
      DocumentCollaborationSnapshotEntity,
      DocumentCollaborationUpdateEntity,
    ]),
  ],
  controllers: [DocumentController],
  providers: [
    {
      provide: DocumentAccessGrantRepository,
      useClass: MikroOrmDocumentAccessGrantRepository,
    },
    {
      provide: DocumentAccessSettingRepository,
      useClass: MikroOrmDocumentAccessSettingRepository,
    },
    {
      provide: DocumentCommandRepository,
      useClass: MikroOrmDocumentCommandRepository,
    },
    {
      provide: DocumentNavigationQueryRepository,
      useClass: MikroOrmDocumentNavigationQueryRepository,
    },
    {
      provide: DocumentSubdocReferenceRepository,
      useClass: MikroOrmDocumentSubdocReferenceRepository,
    },
    {
      provide: DocumentTreeQueryRepository,
      useClass: MikroOrmDocumentTreeQueryRepository,
    },
    {
      provide: DocumentVisitRepository,
      useClass: MikroOrmDocumentVisitRepository,
    },
    {
      provide: PublishRepository,
      useClass: MikroOrmPublishRepository,
    },
    {
      provide: WorkspaceDefaultDocumentProvisioner,
      useClass: WorkspaceDefaultDocumentProvisionerService,
    },
    {
      provide: DocumentCollaborationProjector,
      useClass: DocumentBlockNoteProjectorService,
    },
    {
      provide: DocumentCollaborationRepository,
      useClass: MikroOrmDocumentCollaborationRepository,
    },
    {
      provide: DocumentCollaborationTransactionRunner,
      useClass: MikroOrmDocumentCollaborationTransactionRunner,
    },
    DocumentCollaborationGateway,
    DocumentAccessResolver,
    DocumentAccessCapabilityService,
    DocumentCollaborationReferenceSyncService,
    DocumentCollaborationService,
    DocumentSubdocReferenceSyncService,
    DocumentTreeService,
    DocumentSubdocContentService,
    DocumentObservabilityService,
    ListWorkspaceDocumentsUseCase,
    ListArchivedWorkspaceDocumentsUseCase,
    GetDefaultWorkspaceDocumentUseCase,
    GetDocumentUseCase,
    GetDocumentAccessSettingsUseCase,
    ListDocumentChildrenUseCase,
    ListDocumentCollaboratorsUseCase,
    CreateDocumentUseCase,
    CreateSubdocCommandUseCase,
    ArchiveSubdocCommandUseCase,
    UpdateDocumentUseCase,
    MoveDocumentUseCase,
    DuplicateDocumentUseCase,
    ArchiveDocumentUseCase,
    SyncDocumentSubdocReferencesUseCase,
    SyncReferencedSubdocTitlesUseCase,
    RemoveArchivedSubdocReferencesUseCase,
    RestoreDocumentUseCase,
    PermanentlyDeleteDocumentUseCase,
    ShareDocumentUseCase,
    RevokeDocumentAccessUseCase,
    UpdateDocumentAccessSettingsUseCase,
    NotifyCollaborationPermissionsChangedListener,
  ],
  exports: [
    DocumentAccessGrantRepository,
    DocumentAccessSettingRepository,
    DocumentAccessResolver,
    WorkspaceDefaultDocumentProvisioner,
  ],
})
export class DocumentModule {}
