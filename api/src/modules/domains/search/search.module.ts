import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { DocumentEntity } from '../document/infra/persistence/entities/document.entity';
import { DocumentVisitEntity } from '../document/infra/persistence/entities/document-visit.entity';
import { WorkspaceModule } from '../workspace/workspace.module';
import { SearchController } from './api/rest/search.controller';
import { SearchService } from './app/search.service';

@Module({
  imports: [
    WorkspaceModule,
    MikroOrmModule.forFeature([
      DocumentEntity,
      DocumentVisitEntity,
    ]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
