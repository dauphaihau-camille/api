import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { CurrentUserEntity } from '../auth/infra/persistence/entities/current-user.entity';
import { DocumentEntity } from '../document/infra/persistence/entities/document.entity';
import { WorkspaceEntity } from '../workspace/infra/persistence/entities/workspace.entity';
import { AuditModule } from '../../shared/audit/audit.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { PublishController } from './api/rest/publish.controller';
import { PublishService } from './app/publish.service';
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
  providers: [PublishService],
  exports: [PublishService],
})
export class PublishModule {}
