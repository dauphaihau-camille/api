import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { DocumentModule } from '../document/document.module';
import { DocumentAccessResolver } from '../document/app/policies/document-access.resolver';
import { DocumentEntity } from '../document/infra/persistence/entities/document.entity';
import { DocumentVisitEntity } from '../document/infra/persistence/entities/document-visit.entity';
import { TeamspaceMemberEntity } from '../teamspace/infra/persistence/entities/teamspace-member.entity';
import { WorkspaceModule } from '../workspace/workspace.module';
import { SearchController } from './api/rest/search.controller';
import { SearchRepository } from './app/ports/search.repository';
import { SearchWorkspaceDocumentsUseCase } from './app/use-cases/search-workspace-documents.use-case';
import { MikroOrmSearchRepository } from './infra/mikro-orm-search.repository';

@Module({
  imports: [
    DocumentModule,
    WorkspaceModule,
    MikroOrmModule.forFeature([
      DocumentEntity,
      DocumentVisitEntity,
      TeamspaceMemberEntity,
    ]),
  ],
  controllers: [SearchController],
  providers: [
    SearchWorkspaceDocumentsUseCase,
    DocumentAccessResolver,
    {
      provide: SearchRepository,
      useClass: MikroOrmSearchRepository,
    },
  ],
  exports: [SearchRepository],
})
export class SearchModule {}
