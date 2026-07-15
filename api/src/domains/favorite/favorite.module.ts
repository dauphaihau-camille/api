import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { CurrentUserEntity } from '../auth/infra/persistence/entities/current-user.entity';
import { DocumentEntity } from '../document/infra/persistence/entities/document.entity';
import { DocumentNavigationQueryRepository } from '../document/app/ports/document-navigation-query.repository';
import { MikroOrmDocumentNavigationQueryRepository } from '../document/infra/mikro-orm-document-navigation-query.repository';
import { WorkspaceEntity } from '../workspace/infra/persistence/entities/workspace.entity';
import { AuditModule } from '../../integrations/audit/audit.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { FavoriteController } from './api/rest/favorite.controller';
import { AddDocumentFavoriteUseCase } from './app/use-cases/add-document-favorite.use-case';
import { GetFavoriteStatusUseCase } from './app/use-cases/get-favorite-status.use-case';
import { ListWorkspaceFavoritesUseCase } from './app/use-cases/list-workspace-favorites.use-case';
import { RemoveDocumentFavoriteUseCase } from './app/use-cases/remove-document-favorite.use-case';
import { FavoriteRepository } from './app/ports/favorite.repository';
import { MikroOrmFavoriteRepository } from './infra/mikro-orm-favorite.repository';
import { DocumentFavoriteEntity } from './infra/persistence/entities/document-favorite.entity';

@Module({
  imports: [
    AuditModule,
    WorkspaceModule,
    MikroOrmModule.forFeature([
      CurrentUserEntity,
      WorkspaceEntity,
      DocumentEntity,
      DocumentFavoriteEntity,
    ]),
  ],
  controllers: [FavoriteController],
  providers: [
    ListWorkspaceFavoritesUseCase,
    GetFavoriteStatusUseCase,
    AddDocumentFavoriteUseCase,
    RemoveDocumentFavoriteUseCase,
    {
      provide: FavoriteRepository,
      useClass: MikroOrmFavoriteRepository,
    },
    {
      provide: DocumentNavigationQueryRepository,
      useClass: MikroOrmDocumentNavigationQueryRepository,
    },
  ],
  exports: [FavoriteRepository],
})
export class FavoriteModule {}
