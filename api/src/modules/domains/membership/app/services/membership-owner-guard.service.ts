import { Injectable } from '@nestjs/common';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import { MembershipLastOwnerConflictError } from '../errors/membership-app.error';
import { MembershipRepository } from '../ports/membership.repository';

@Injectable()
export class MembershipOwnerGuardService {
  constructor(private readonly membershipRepository: MembershipRepository) {}

  async assertNotLastOwner(workspaceId: string): Promise<void> {
    const ownerCount = await this.membershipRepository.countMembersByRole(
      workspaceId,
      WorkspaceRole.OWNER,
    );

    if (ownerCount <= 1) {
      throw new MembershipLastOwnerConflictError();
    }
  }
}
