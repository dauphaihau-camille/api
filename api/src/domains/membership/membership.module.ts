import { Module } from '@nestjs/common';
import { AuditModule } from '../../integrations/audit/audit.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { MembershipController } from './api/rest/membership.controller';
import { MembershipRepository } from './app/ports/membership.repository';
import { MembershipOwnerGuardService } from './app/services/membership-owner-guard.service';
import { AddWorkspaceMemberUseCase } from './app/use-cases/add-workspace-member.use-case';
import { ListWorkspaceMembersUseCase } from './app/use-cases/list-workspace-members.use-case';
import { RemoveWorkspaceMemberUseCase } from './app/use-cases/remove-workspace-member.use-case';
import { SearchWorkspaceMembersUseCase } from './app/use-cases/search-workspace-members.use-case';
import { UpdateWorkspaceMemberUseCase } from './app/use-cases/update-workspace-member.use-case';
import { WorkspaceMembershipRepository } from './infra/workspace-membership.repository';

@Module({
  imports: [WorkspaceModule, AuditModule],
  controllers: [MembershipController],
  providers: [
    {
      provide: MembershipRepository,
      useClass: WorkspaceMembershipRepository,
    },
    MembershipOwnerGuardService,
    ListWorkspaceMembersUseCase,
    SearchWorkspaceMembersUseCase,
    AddWorkspaceMemberUseCase,
    UpdateWorkspaceMemberUseCase,
    RemoveWorkspaceMemberUseCase,
  ],
})
export class MembershipModule {}
