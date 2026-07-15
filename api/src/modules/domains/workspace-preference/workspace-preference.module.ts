import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { CurrentUserEntity } from '../auth/infra/persistence/entities/current-user.entity';
import { WorkspaceEntity } from '../workspace/infra/persistence/entities/workspace.entity';
import { WorkspaceModule } from '../workspace/workspace.module';
import { WorkspacePreferenceController } from './api/rest/workspace-preference.controller';
import { WorkspacePreferenceRepository } from './app/ports/workspace-preference.repository';
import { GetWorkspacePreferenceUseCase } from './app/use-cases/get-workspace-preference.use-case';
import { GetLastActiveWorkspaceUseCase } from './app/use-cases/get-last-active-workspace.use-case';
import { MarkWorkspaceAsLastActiveUseCase } from './app/use-cases/mark-workspace-as-last-active.use-case';
import { UpdateWorkspacePreferenceUseCase } from './app/use-cases/update-workspace-preference.use-case';
import { MikroOrmWorkspacePreferenceRepository } from './infra/mikro-orm-workspace-preference.repository';
import { WorkspacePreferenceEntity } from './infra/persistence/entities/workspace-preference.entity';

@Module({
  imports: [
    WorkspaceModule,
    MikroOrmModule.forFeature([
      CurrentUserEntity,
      WorkspaceEntity,
      WorkspacePreferenceEntity,
    ]),
  ],
  controllers: [WorkspacePreferenceController],
  providers: [
    {
      provide: WorkspacePreferenceRepository,
      useClass: MikroOrmWorkspacePreferenceRepository,
    },
    GetWorkspacePreferenceUseCase,
    GetLastActiveWorkspaceUseCase,
    MarkWorkspaceAsLastActiveUseCase,
    UpdateWorkspacePreferenceUseCase,
  ],
})
export class WorkspacePreferenceModule {}
