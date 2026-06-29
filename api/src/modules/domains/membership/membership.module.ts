import { Module } from '@nestjs/common';
import { AuditModule } from '../../shared/audit/audit.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { MembershipService } from './app/membership.service';
import { MembershipController } from './api/rest/membership.controller';

@Module({
  imports: [WorkspaceModule, AuditModule],
  controllers: [MembershipController],
  providers: [MembershipService],
})
export class MembershipModule {}
