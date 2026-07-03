import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { CurrentUserEntity } from '../auth/infra/persistence/entities/current-user.entity';
import { DocumentEntity } from '../document/infra/persistence/entities/document.entity';
import { WorkspaceEntity } from '../workspace/infra/persistence/entities/workspace.entity';
import { AuditModule } from '../../shared/audit/audit.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { FavoriteController } from './api/rest/favorite.controller';
import { FavoriteService } from './app/favorite.service';
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
  providers: [FavoriteService],
  exports: [FavoriteService],
})
export class FavoriteModule {}
