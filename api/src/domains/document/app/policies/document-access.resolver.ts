import { Injectable } from '@nestjs/common';
import { TeamspaceAccessMode } from '../../../teamspace/domain/enums/teamspace-access-mode.enum';
import { TeamspaceMemberRole } from '../../../teamspace/domain/enums/teamspace-member-role.enum';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';

export type DocumentCapabilities = {
  canEdit: boolean;
  canManageAccess: boolean;
  canView: boolean;
  permission: DocumentPermission;
};

export type DocumentPermission = 'none' | 'view' | 'edit' | 'manage';

export type DocumentAccessContext = {
  actorUserId: string;
  documentOwnerUserId: string;
  documentTeamspaceId?: string;
  teamspaceAccessMode?: TeamspaceAccessMode;
  teamspaceMemberRole?: TeamspaceMemberRole;
  workspaceRole: WorkspaceRole;
};

@Injectable()
export class DocumentAccessResolver {
  resolve(input: WorkspaceRole | DocumentAccessContext): DocumentCapabilities {
    if (typeof input === 'string') {
      const canEditWorkspaceDocument =
        input === WorkspaceRole.OWNER
        || input === WorkspaceRole.ADMIN;

      return {
        canEdit: canEditWorkspaceDocument,
        canManageAccess: canEditWorkspaceDocument,
        canView: true,
        permission: canEditWorkspaceDocument ? 'manage' : 'view',
      };
    }

    const isWorkspaceAdministrator =
      input.workspaceRole === WorkspaceRole.OWNER
      || input.workspaceRole === WorkspaceRole.ADMIN;

    const isPrivateOwner =
      !input.documentTeamspaceId
      && input.actorUserId === input.documentOwnerUserId;

    const teamspacePermission = this.resolveTeamspacePermission(input);

    const isTeamspaceDocument =
      Boolean(input.documentTeamspaceId);

    const canEdit = isPrivateOwner
      || (isWorkspaceAdministrator && isTeamspaceDocument)
      || teamspacePermission === TeamspaceMemberRole.EDITOR
      || teamspacePermission === TeamspaceMemberRole.MANAGER;

    const canManageAccess = isPrivateOwner
      || (isWorkspaceAdministrator && isTeamspaceDocument)
      || teamspacePermission === TeamspaceMemberRole.MANAGER;

    const canView = (isWorkspaceAdministrator && isTeamspaceDocument)
      || Boolean(teamspacePermission)
      || isPrivateOwner;

    return {
      canEdit,
      canManageAccess,
      canView,
      permission: this.resolvePermission({
        canEdit,
        canManageAccess,
        canView,
      }),
    };
  }

  private resolveTeamspacePermission(
    context: DocumentAccessContext,
  ): TeamspaceMemberRole | undefined {
    if (!context.documentTeamspaceId) {
      return undefined;
    }

    if (context.teamspaceMemberRole) {
      return context.teamspaceMemberRole;
    }

    if ((context.teamspaceAccessMode ?? TeamspaceAccessMode.OPEN) === TeamspaceAccessMode.OPEN) {
      return TeamspaceMemberRole.VIEWER;
    }

    return undefined;
  }

  private resolvePermission(input: {
    canEdit: boolean;
    canManageAccess: boolean;
    canView: boolean;
  }): DocumentPermission {
    if (input.canManageAccess) {
      return 'manage';
    }

    if (input.canEdit) {
      return 'edit';
    }

    if (input.canView) {
      return 'view';
    }

    return 'none';
  }
}
