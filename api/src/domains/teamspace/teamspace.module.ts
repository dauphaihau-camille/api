import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { AuditModule } from '../../integrations/audit/audit.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { TeamspaceController } from './api/rest/teamspace.controller';
import { TeamspaceRepository } from './app/ports/teamspace.repository';
import { CreateTeamspaceUseCase } from './app/use-cases/create-teamspace.use-case';
import { ListTeamspacesUseCase } from './app/use-cases/list-teamspaces.use-case';
import { UpdateTeamspaceUseCase } from './app/use-cases/update-teamspace.use-case';
import { MikroOrmTeamspaceRepository } from './infra/persistence/mikro-orm-teamspace.repository';
import { TeamspaceEntity } from './infra/persistence/entities/teamspace.entity';

@Module({
  imports: [
    AuditModule,
    WorkspaceModule,
    MikroOrmModule.forFeature([TeamspaceEntity]),
  ],
  controllers: [TeamspaceController],
  providers: [
    {
      provide: TeamspaceRepository,
      useClass: MikroOrmTeamspaceRepository,
    },
    ListTeamspacesUseCase,
    CreateTeamspaceUseCase,
    UpdateTeamspaceUseCase,
  ],
})
export class TeamspaceModule {}
