import { Module } from '@nestjs/common';
import { WorkspaceService } from './app/workspace.service';
import { WorkspaceController } from './api/rest/workspace.controller';

@Module({
  controllers: [WorkspaceController],
  providers: [WorkspaceService],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
