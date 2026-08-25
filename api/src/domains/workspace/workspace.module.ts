import { MikroOrmModule } from '@mikro-orm/nestjs';
import { forwardRef, Module } from '@nestjs/common';
import { AuditModule } from '../../integrations/audit/audit.module';
import { StorageModule } from '../../integrations/storage/storage.module';
import { CurrentUserEntity } from '../auth/infra/persistence/entities/current-user.entity';
import { DocumentModule } from '../document/document.module';
import { MikroOrmWorkspaceRepository } from './infra/mikro-orm-workspace.repository';
import { WorkspaceRepository } from './app/ports/workspace.repository';
import { WorkspaceProvisioningService } from './app/services/workspace-provisioning.service';
import { CreateWorkspaceUseCase } from './app/use-cases/create-workspace.use-case';
import { DeleteWorkspaceUseCase } from './app/use-cases/delete-workspace.use-case';
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
    forwardRef(() => DocumentModule),
    MikroOrmModule.forFeature([
      CurrentUserEntity,
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
    DeleteWorkspaceUseCase,
    {
      provide: WorkspaceRepository,
      useClass: MikroOrmWorkspaceRepository,
    },
  ],
  exports: [WorkspaceRepository],
})
export class WorkspaceModule {}
