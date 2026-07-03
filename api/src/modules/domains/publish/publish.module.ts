import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { CurrentUserEntity } from '../auth/infra/persistence/entities/current-user.entity';
import { DocumentEntity } from '../document/infra/persistence/entities/document.entity';
import { WorkspaceEntity } from '../workspace/infra/persistence/entities/workspace.entity';
import { AuditModule } from '../../shared/audit/audit.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { PublishController } from './api/rest/publish.controller';
import { PublishRepository } from './app/ports/publish.repository';
import { GetPublicDocumentUseCase } from './app/use-cases/get-public-document.use-case';
import { GetPublishStatusUseCase } from './app/use-cases/get-publish-status.use-case';
import { PublishDocumentUseCase } from './app/use-cases/publish-document.use-case';
import { UnpublishDocumentUseCase } from './app/use-cases/unpublish-document.use-case';
import { MikroOrmPublishRepository } from './infra/mikro-orm-publish.repository';
import { PublishedDocumentEntity } from './infra/persistence/entities/published-document.entity';

@Module({
  imports: [
    AuditModule,
    WorkspaceModule,
    MikroOrmModule.forFeature([
      CurrentUserEntity,
      WorkspaceEntity,
      DocumentEntity,
      PublishedDocumentEntity,
    ]),
  ],
  controllers: [PublishController],
  providers: [
    {
      provide: PublishRepository,
      useClass: MikroOrmPublishRepository,
    },
    GetPublicDocumentUseCase,
    GetPublishStatusUseCase,
    PublishDocumentUseCase,
    UnpublishDocumentUseCase,
  ],
})
export class PublishModule {}
