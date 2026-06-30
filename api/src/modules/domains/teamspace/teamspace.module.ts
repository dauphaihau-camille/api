import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { CurrentUserEntity } from '../auth/infra/persistence/entities/current-user.entity';
import { AuditModule } from '../../shared/audit/audit.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { TeamspaceController } from './api/rest/teamspace.controller';
import { TeamspaceService } from './app/teamspace.service';
import { TeamspaceEntity } from './infra/persistence/entities/teamspace.entity';
import { WorkspaceEntity } from '../workspace/infra/persistence/entities/workspace.entity';

@Module({
  imports: [
    AuditModule,
    WorkspaceModule,
    MikroOrmModule.forFeature([
      CurrentUserEntity,
      WorkspaceEntity,
      TeamspaceEntity,
    ]),
  ],
  controllers: [TeamspaceController],
  providers: [TeamspaceService],
  exports: [TeamspaceService],
})
export class TeamspaceModule {}
