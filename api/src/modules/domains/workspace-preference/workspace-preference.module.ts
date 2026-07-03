import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { CurrentUserEntity } from '../auth/infra/persistence/entities/current-user.entity';
import { WorkspaceEntity } from '../workspace/infra/persistence/entities/workspace.entity';
import { WorkspaceModule } from '../workspace/workspace.module';
import { WorkspacePreferenceController } from './api/rest/workspace-preference.controller';
import { WorkspacePreferenceService } from './app/workspace-preference.service';
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
  providers: [WorkspacePreferenceService],
  exports: [WorkspacePreferenceService],
})
export class WorkspacePreferenceModule {}
