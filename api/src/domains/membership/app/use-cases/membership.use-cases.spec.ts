import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { UserStatus } from '~/domains/auth/domain/enums/user-status.enum';
import type { AuditService } from '~/integrations/audit/audit.service';
import type { WorkspaceMemberSummary } from '../../../workspace/app/contracts/workspace.contract';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import {
  MembershipAlreadyExistsError,
  MembershipLastOwnerConflictError,
  MembershipVersionConflictError,
} from '../errors/membership-app.error';
import type { MembershipRepository } from '../ports/membership.repository';
import { MembershipRepositoryVersionConflictError } from '../ports/membership.repository';
import { MembershipOwnerGuardService } from '../services/membership-owner-guard.service';
import { AddWorkspaceMemberUseCase } from './add-workspace-member.use-case';
import { UpdateWorkspaceMemberUseCase } from './update-workspace-member.use-case';

describe('Membership use cases', () => {
  const currentUser: AuthenticatedUser = {
    userId: 'user-1',
    email: 'user@example.com',
    status: UserStatus.ACTIVE,
    sessionId: 'session-1',
    roles: [],
    permissions: [],
  };

  function createMembershipRepository(role = WorkspaceRole.OWNER) {
    return {
      findAllWorkspacesForUser: jest.fn().mockResolvedValue([
        {
          id: 'workspace-1',
          version: 1,
          slug: 'workspace-1',
          name: 'Workspace 1',
          description: undefined,
          currentUserRole: role,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]),
      findMembers: jest.fn(),
      findMemberById: jest.fn(),
      findUserByEmail: jest.fn(),
      addMember: jest.fn(),
      updateMemberRole: jest.fn(),
      removeMember: jest.fn(),
      countMembersByRole: jest.fn(),
    } as unknown as jest.Mocked<MembershipRepository>;
  }

  function createAuditService() {
    return {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
  }

  function memberSummary(overrides: Partial<WorkspaceMemberSummary> = {}): WorkspaceMemberSummary {
    return {
      id: 'member-1',
      version: 1,
      role: WorkspaceRole.MEMBER,
      userId: 'user-2',
      email: 'member@example.com',
      displayName: 'Member',
      avatar: undefined,
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    };
  }

  it('rejects duplicate workspace members before add', async () => {
    const membershipRepository = createMembershipRepository();
    const auditService = createAuditService();
    membershipRepository.findUserByEmail.mockResolvedValue({
      id: 'user-2',
      email: 'member@example.com',
    });
    membershipRepository.findMembers.mockResolvedValue([memberSummary()]);

    const useCase = new AddWorkspaceMemberUseCase(membershipRepository, auditService);

    await expect(useCase.execute('workspace-1', currentUser, {
      email: 'member@example.com',
      role: WorkspaceRole.MEMBER,
    })).rejects.toBeInstanceOf(MembershipAlreadyExistsError);
  });

  it('maps repository version conflicts to app errors', async () => {
    const membershipRepository = createMembershipRepository();
    const auditService = createAuditService();
    membershipRepository.findMemberById.mockResolvedValue(memberSummary());
    membershipRepository.updateMemberRole.mockRejectedValue(
      new MembershipRepositoryVersionConflictError(),
    );

    const useCase = new UpdateWorkspaceMemberUseCase(
      membershipRepository,
      new MembershipOwnerGuardService(membershipRepository),
      auditService,
    );

    await expect(useCase.execute('workspace-1', 'member-1', currentUser, {
      version: 1,
      role: WorkspaceRole.ADMIN,
    })).rejects.toBeInstanceOf(MembershipVersionConflictError);
  });

  it('prevents removing the last owner role from a workspace', async () => {
    const membershipRepository = createMembershipRepository();
    const auditService = createAuditService();
    membershipRepository.findMemberById.mockResolvedValue(memberSummary({
      role: WorkspaceRole.OWNER,
    }));
    membershipRepository.countMembersByRole.mockResolvedValue(1);

    const useCase = new UpdateWorkspaceMemberUseCase(
      membershipRepository,
      new MembershipOwnerGuardService(membershipRepository),
      auditService,
    );

    await expect(useCase.execute('workspace-1', 'member-1', currentUser, {
      version: 1,
      role: WorkspaceRole.ADMIN,
    })).rejects.toBeInstanceOf(MembershipLastOwnerConflictError);
  });
});
