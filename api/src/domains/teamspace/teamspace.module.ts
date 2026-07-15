import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { AuditModule } from '../../integrations/audit/audit.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { TeamspaceController } from './api/rest/teamspace.controller';
import { TeamspaceService } from './app/teamspace.service';
import { TeamspaceEntity } from './infra/persistence/entities/teamspace.entity';

@Module({
  imports: [
    AuditModule,
    WorkspaceModule,
    MikroOrmModule.forFeature([TeamspaceEntity]),
  ],
  controllers: [TeamspaceController],
  providers: [TeamspaceService],
  exports: [TeamspaceService],
})
export class TeamspaceModule {}
