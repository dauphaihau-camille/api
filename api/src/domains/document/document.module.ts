import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { CurrentUserEntity } from '../auth/infra/persistence/entities/current-user.entity';
import { AuditModule } from '../../integrations/audit/audit.module';
import { ObservabilityModule } from '../../platform/observability/observability.module';
import { QueueModule } from '../../integrations/queue/queue.module';
import { PublishRepository } from '../publish/app/ports/publish.repository';
import { MikroOrmPublishRepository } from '../publish/infra/mikro-orm-publish.repository';
import { PublishedDocumentEntity } from '../publish/infra/persistence/entities/published-document.entity';
import { WorkspaceModule } from '../workspace/workspace.module';
import { TeamspaceEntity } from '../teamspace/infra/persistence/entities/teamspace.entity';
import { WorkspaceEntity } from '../workspace/infra/persistence/entities/workspace.entity';
import { DocumentController } from './api/rest/document.controller';
import { DocumentCommandRepository } from './app/ports/document-command.repository';
import { DocumentNavigationQueryRepository } from './app/ports/document-navigation-query.repository';
import { DocumentSubdocReferenceRepository } from './app/ports/document-subdoc-reference.repository';
import { DocumentTreeQueryRepository } from './app/ports/document-tree-query.repository';
import { DocumentVisitRepository } from './app/ports/document-visit.repository';
import { ArchiveDocumentUseCase } from './app/use-cases/archive-document.use-case';
import { ArchiveSubdocCommandUseCase } from './app/use-cases/archive-subdoc-command.use-case';
import { CreateDocumentUseCase } from './app/use-cases/create-document.use-case';
import { CreateSubdocCommandUseCase } from './app/use-cases/create-subdoc-command.use-case';
import { DocumentSubdocService } from './app/services/document-subdoc.service';
import { DocumentTreeService } from './app/services/document-tree.service';
import { DuplicateDocumentUseCase } from './app/use-cases/duplicate-document.use-case';
import { GetDefaultWorkspaceDocumentUseCase } from './app/use-cases/get-default-workspace-document.use-case';
import { GetDocumentUseCase } from './app/use-cases/get-document.use-case';
import { ListDocumentChildrenUseCase } from './app/use-cases/list-document-children.use-case';
import { ListArchivedWorkspaceDocumentsUseCase } from './app/use-cases/list-archived-workspace-documents.use-case';
import { ListWorkspaceDocumentsUseCase } from './app/use-cases/list-workspace-documents.use-case';
import { MoveDocumentUseCase } from './app/use-cases/move-document.use-case';
import { PermanentlyDeleteDocumentUseCase } from './app/use-cases/permanently-delete-document.use-case';
import { RestoreDocumentUseCase } from './app/use-cases/restore-document.use-case';
import { UpdateDocumentUseCase } from './app/use-cases/update-document.use-case';
import { MikroOrmDocumentCommandRepository } from './infra/mikro-orm-document-command.repository';
import { MikroOrmDocumentNavigationQueryRepository } from './infra/mikro-orm-document-navigation-query.repository';
import { MikroOrmDocumentSubdocReferenceRepository } from './infra/mikro-orm-document-subdoc-reference.repository';
import { MikroOrmDocumentTreeQueryRepository } from './infra/mikro-orm-document-tree-query.repository';
import { MikroOrmDocumentVisitRepository } from './infra/mikro-orm-document-visit.repository';
import { DocumentObservabilityService } from './observability/document-observability.service';
import { DocumentEntity } from './infra/persistence/entities/document.entity';
import { DocumentSubdocReferenceEntity } from './infra/persistence/entities/document-subdoc-reference.entity';
import { DocumentVisitEntity } from './infra/persistence/entities/document-visit.entity';
import { DocumentFavoriteEntity } from '../favorite/infra/persistence/entities/document-favorite.entity';

@Module({
  imports: [
    AuditModule,
    ObservabilityModule,
    QueueModule,
    WorkspaceModule,
    MikroOrmModule.forFeature([
      CurrentUserEntity,
      WorkspaceEntity,
      TeamspaceEntity,
      DocumentEntity,
      DocumentSubdocReferenceEntity,
      DocumentVisitEntity,
      DocumentFavoriteEntity,
      PublishedDocumentEntity,
    ]),
  ],
  controllers: [DocumentController],
  providers: [
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
    DocumentTreeService,
    DocumentSubdocService,
    DocumentObservabilityService,
    ListWorkspaceDocumentsUseCase,
    ListArchivedWorkspaceDocumentsUseCase,
    GetDefaultWorkspaceDocumentUseCase,
    GetDocumentUseCase,
    ListDocumentChildrenUseCase,
    CreateDocumentUseCase,
    CreateSubdocCommandUseCase,
    ArchiveSubdocCommandUseCase,
    UpdateDocumentUseCase,
    MoveDocumentUseCase,
    DuplicateDocumentUseCase,
    ArchiveDocumentUseCase,
    RestoreDocumentUseCase,
    PermanentlyDeleteDocumentUseCase,
  ],
})
export class DocumentModule {}
