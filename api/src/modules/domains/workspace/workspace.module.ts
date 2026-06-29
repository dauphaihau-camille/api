import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { StorageModule } from '../../shared/storage/storage.module';
import { CurrentUserEntity } from '../auth/infra/persistence/entities/current-user.entity';
import { MikroOrmWorkspaceRepository } from './infra/mikro-orm-workspace.repository';
import { WorkspaceRepository } from './app/workspace.repository';
import { WorkspaceService } from './app/workspace.service';
import { WorkspaceController } from './api/rest/workspace.controller';
import { WorkspaceEntity } from './infra/persistence/entities/workspace.entity';
import { WorkspaceMemberEntity } from './infra/persistence/entities/workspace-member.entity';

@Module({
  imports: [
    StorageModule,
    MikroOrmModule.forFeature([
      CurrentUserEntity,
      WorkspaceEntity,
      WorkspaceMemberEntity,
    ]),
  ],
  controllers: [WorkspaceController],
  providers: [
    WorkspaceService,
    {
      provide: WorkspaceRepository,
      useClass: MikroOrmWorkspaceRepository,
    },
  ],
  exports: [WorkspaceService, WorkspaceRepository],
})
export class WorkspaceModule {}
