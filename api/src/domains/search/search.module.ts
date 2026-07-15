import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { DocumentEntity } from '../document/infra/persistence/entities/document.entity';
import { DocumentVisitEntity } from '../document/infra/persistence/entities/document-visit.entity';
import { WorkspaceModule } from '../workspace/workspace.module';
import { SearchController } from './api/rest/search.controller';
import { SearchRepository } from './app/ports/search.repository';
import { SearchWorkspaceDocumentsUseCase } from './app/use-cases/search-workspace-documents.use-case';
import { MikroOrmSearchRepository } from './infra/mikro-orm-search.repository';

@Module({
  imports: [
    WorkspaceModule,
    MikroOrmModule.forFeature([
      DocumentEntity,
      DocumentVisitEntity,
    ]),
  ],
  controllers: [SearchController],
  providers: [
    SearchWorkspaceDocumentsUseCase,
    {
      provide: SearchRepository,
      useClass: MikroOrmSearchRepository,
    },
  ],
  exports: [SearchRepository],
})
export class SearchModule {}
