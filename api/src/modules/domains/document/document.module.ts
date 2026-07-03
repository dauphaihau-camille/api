import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { CurrentUserEntity } from '../auth/infra/persistence/entities/current-user.entity';
import { AuditModule } from '../../shared/audit/audit.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { TeamspaceEntity } from '../teamspace/infra/persistence/entities/teamspace.entity';
import { WorkspaceEntity } from '../workspace/infra/persistence/entities/workspace.entity';
import { DocumentController } from './api/rest/document.controller';
import { DocumentService } from './app/document.service';
import { DocumentEntity } from './infra/persistence/entities/document.entity';
import { DocumentSubdocReferenceEntity } from './infra/persistence/entities/document-subdoc-reference.entity';

@Module({
  imports: [
    AuditModule,
    WorkspaceModule,
    MikroOrmModule.forFeature([
      CurrentUserEntity,
      WorkspaceEntity,
      TeamspaceEntity,
      DocumentEntity,
      DocumentSubdocReferenceEntity,
    ]),
  ],
  controllers: [DocumentController],
  providers: [DocumentService],
  exports: [DocumentService],
})
export class DocumentModule {}
