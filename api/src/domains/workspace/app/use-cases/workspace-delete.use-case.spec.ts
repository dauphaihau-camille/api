import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { UserStatus } from '~/domains/auth/domain/enums/user-status.enum';
import type { AuditService } from '~/integrations/audit/audit.service';
import { WorkspaceRole } from '../../domain/enums/workspace-role.enum';
import {
  WorkspaceDeletePermissionDeniedError,
  WorkspaceNotFoundError,
} from '../errors/workspace-app.error';
import type { WorkspaceRepository } from '../ports/workspace.repository';
import { DeleteWorkspaceUseCase } from './delete-workspace.use-case';

describe('DeleteWorkspaceUseCase', () => {
  const currentUser: AuthenticatedUser = {
    userId: 'user-1',
    email: 'user@example.com',
    status: UserStatus.ACTIVE,
    sessionId: 'session-1',
    roles: [],
    permissions: [],
  };

  function createWorkspaceRepository(role = WorkspaceRole.OWNER) {
    return {
      findAllForUser: jest.fn().mockResolvedValue([
        {
          id: 'workspace-1',
          version: 1,
          slug: 'acme-product',
          name: 'Acme Product',
          description: undefined,
          currentUserRole: role,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]),
      findBySlug: jest.fn(),
      findById: jest.fn(),
      findWorkspaceAccess: jest.fn(),
      createWorkspace: jest.fn(),
      updateWorkspace: jest.fn(),
      deleteWorkspace: jest.fn().mockResolvedValue(true),
      findMembers: jest.fn(),
      searchMembers: jest.fn(),
      findMemberById: jest.fn(),
      findUserByEmail: jest.fn(),
      addMember: jest.fn(),
      updateMemberRole: jest.fn(),
      removeMember: jest.fn(),
      countMembersByRole: jest.fn(),
    } as unknown as jest.Mocked<WorkspaceRepository>;
  }

  function createAuditService() {
    return {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
  }

  it('deletes an owned workspace and records an audit event', async () => {
    const workspaceRepository = createWorkspaceRepository();
    const auditService = createAuditService();
    const useCase = new DeleteWorkspaceUseCase(workspaceRepository, auditService);

    await useCase.execute('acme-product', currentUser);

    expect(workspaceRepository.deleteWorkspace).toHaveBeenCalledWith('workspace-1');
    expect(auditService.record).toHaveBeenCalledWith({
      action: 'workspace.deleted',
      resourceType: 'workspace',
      resourceId: 'workspace-1',
      metadata: {
        slug: 'acme-product',
        name: 'Acme Product',
      },
    });
  });

  it('rejects non-owner workspace deletion', async () => {
    const workspaceRepository = createWorkspaceRepository(WorkspaceRole.ADMIN);
    const auditService = createAuditService();
    const useCase = new DeleteWorkspaceUseCase(workspaceRepository, auditService);

    await expect(useCase.execute('acme-product', currentUser)).rejects.toBeInstanceOf(
      WorkspaceDeletePermissionDeniedError,
    );
    expect(workspaceRepository.deleteWorkspace).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('reports not found when the workspace is gone before deletion', async () => {
    const workspaceRepository = createWorkspaceRepository();
    const auditService = createAuditService();
    workspaceRepository.deleteWorkspace.mockResolvedValue(false);
    const useCase = new DeleteWorkspaceUseCase(workspaceRepository, auditService);

    await expect(useCase.execute('acme-product', currentUser)).rejects.toBeInstanceOf(
      WorkspaceNotFoundError,
    );
    expect(auditService.record).not.toHaveBeenCalled();
  });
});
