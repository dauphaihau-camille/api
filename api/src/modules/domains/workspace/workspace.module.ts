import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { AuditModule } from '../../shared/audit/audit.module';
import { StorageModule } from '../../shared/storage/storage.module';
import { DocumentEntity } from '../document/infra/persistence/entities/document.entity';
import { TeamspaceEntity } from '../teamspace/infra/persistence/entities/teamspace.entity';
import { CurrentUserEntity } from '../auth/infra/persistence/entities/current-user.entity';
import { MikroOrmWorkspaceRepository } from './infra/mikro-orm-workspace.repository';
import { WorkspaceRepository } from './app/ports/workspace.repository';
import { WorkspaceProvisioningService } from './app/services/workspace-provisioning.service';
import { CreateWorkspaceUseCase } from './app/use-cases/create-workspace.use-case';
import { GetWorkspaceUseCase } from './app/use-cases/get-workspace.use-case';
import { ListUserWorkspacesUseCase } from './app/use-cases/list-user-workspaces.use-case';
import { UpdateWorkspaceUseCase } from './app/use-cases/update-workspace.use-case';
import { WorkspaceController } from './api/rest/workspace.controller';
import { WorkspaceEntity } from './infra/persistence/entities/workspace.entity';
import { WorkspaceMemberEntity } from './infra/persistence/entities/workspace-member.entity';

@Module({
  imports: [
    AuditModule,
    StorageModule,
    MikroOrmModule.forFeature([
      CurrentUserEntity,
      DocumentEntity,
      TeamspaceEntity,
      WorkspaceEntity,
      WorkspaceMemberEntity,
    ]),
  ],
  controllers: [WorkspaceController],
  providers: [
    WorkspaceProvisioningService,
    ListUserWorkspacesUseCase,
    GetWorkspaceUseCase,
    CreateWorkspaceUseCase,
    UpdateWorkspaceUseCase,
    {
      provide: WorkspaceRepository,
      useClass: MikroOrmWorkspaceRepository,
    },
  ],
  exports: [WorkspaceRepository],
})
export class WorkspaceModule {}
