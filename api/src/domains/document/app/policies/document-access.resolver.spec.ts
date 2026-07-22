import { TeamspaceAccessMode } from '../../../teamspace/domain/enums/teamspace-access-mode.enum';
import { TeamspaceMemberRole } from '../../../teamspace/domain/enums/teamspace-member-role.enum';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import { DocumentAccessResolver } from './document-access.resolver';

describe('DocumentAccessResolver', () => {
  const resolver = new DocumentAccessResolver();

  it('grants document view and edit capabilities to a workspace owner', () => {
    expect(resolver.resolve(WorkspaceRole.OWNER)).toEqual({
      canEdit: true,
      canManageAccess: true,
      canView: true,
      permission: 'manage',
    });
  });

  it('grants document view and edit capabilities to a workspace admin', () => {
    expect(resolver.resolve(WorkspaceRole.ADMIN)).toEqual({
      canEdit: true,
      canManageAccess: true,
      canView: true,
      permission: 'manage',
    });
  });

  it('grants view-only document capabilities to a workspace member', () => {
    expect(resolver.resolve(WorkspaceRole.MEMBER)).toEqual({
      canEdit: false,
      canManageAccess: false,
      canView: true,
      permission: 'view',
    });
  });

  it('grants edit capabilities to the owner of a private document', () => {
    expect(resolver.resolve({
      actorUserId: 'user-1',
      documentOwnerUserId: 'user-1',
      workspaceRole: WorkspaceRole.MEMBER,
    })).toEqual({
      canEdit: true,
      canManageAccess: true,
      canView: true,
      permission: 'manage',
    });
  });

  it('keeps open teamspace documents read-only for workspace members by default', () => {
    expect(resolver.resolve({
      actorUserId: 'user-1',
      documentOwnerUserId: 'user-1',
      documentTeamspaceId: 'teamspace-1',
      workspaceRole: WorkspaceRole.MEMBER,
    })).toEqual({
      canEdit: false,
      canManageAccess: false,
      canView: true,
      permission: 'view',
    });
  });

  it('hides restricted teamspace documents from non-members', () => {
    expect(resolver.resolve({
      actorUserId: 'user-1',
      documentOwnerUserId: 'user-1',
      documentTeamspaceId: 'teamspace-1',
      teamspaceAccessMode: TeamspaceAccessMode.RESTRICTED,
      workspaceRole: WorkspaceRole.MEMBER,
    })).toEqual({
      canEdit: false,
      canManageAccess: false,
      canView: false,
      permission: 'none',
    });
  });

  it.each([
    [TeamspaceMemberRole.VIEWER, false, false, 'view'],
    [TeamspaceMemberRole.EDITOR, true, false, 'edit'],
    [TeamspaceMemberRole.MANAGER, true, true, 'manage'],
  ])(
    'derives restricted teamspace capabilities for a %s',
    (teamspaceMemberRole, canEdit, canManageAccess, permission) => {
      expect(resolver.resolve({
        actorUserId: 'user-1',
        documentOwnerUserId: 'another-user',
        documentTeamspaceId: 'teamspace-1',
        teamspaceAccessMode: TeamspaceAccessMode.RESTRICTED,
        teamspaceMemberRole,
        workspaceRole: WorkspaceRole.MEMBER,
      })).toEqual({
        canEdit,
        canManageAccess,
        canView: true,
        permission,
      });
    },
  );

  it('hides private documents from workspace members who do not own them', () => {
    expect(resolver.resolve({
      actorUserId: 'user-1',
      documentOwnerUserId: 'user-2',
      workspaceRole: WorkspaceRole.MEMBER,
    })).toEqual({
      canEdit: false,
      canManageAccess: false,
      canView: false,
      permission: 'none',
    });
  });

  it.each([
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
  ])(
    'does not let a workspace %s view private documents owned by another user',
    (workspaceRole) => {
      expect(resolver.resolve({
        actorUserId: 'user-1',
        documentOwnerUserId: 'user-2',
        workspaceRole,
      })).toEqual({
        canEdit: false,
        canManageAccess: false,
        canView: false,
        permission: 'none',
      });
    },
  );
});
