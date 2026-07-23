import { Injectable } from '@nestjs/common';
import { TeamspaceAccessMode } from '../../../teamspace/domain/enums/teamspace-access-mode.enum';
import { TeamspaceMemberRole } from '../../../teamspace/domain/enums/teamspace-member-role.enum';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import { DocumentAccessGrantPermission } from '../../domain/enums/document-access-grant-permission.enum';

export type DocumentCapabilities = {
  accessScope: DocumentAccessScope;
  canEdit: boolean;
  canManageAccess: boolean;
  canView: boolean;
  permission: DocumentPermission;
};

export type DocumentPermission = 'none' | 'view' | 'edit' | 'manage';
export type DocumentAccessScope = 'private' | 'shared' | 'teamspace';

export type DocumentAccessContext = {
  actorUserId: string;
  documentOwnerUserId: string;
  documentTeamspaceId?: string;
  documentHasActiveGrants?: boolean;
  directGrantPermission?: DocumentAccessGrantPermission;
  ancestorGrantPermission?: DocumentAccessGrantPermission;
  workspaceMemberPermission?: DocumentAccessGrantPermission;
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
        accessScope: 'private',
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
    const grantPermission = this.resolveGrantPermission(input.directGrantPermission);
    const ancestorGrantPermission = this.resolveGrantPermission(input.ancestorGrantPermission);
    const workspaceMemberPermission = this.resolveGrantPermission(input.workspaceMemberPermission);

    const isTeamspaceDocument = Boolean(input.documentTeamspaceId);

    const effectivePermission = this.strongestPermission([
      teamspacePermission ? this.teamspaceRoleToPermission(teamspacePermission) : undefined,
      grantPermission,
      ancestorGrantPermission,
      workspaceMemberPermission,
    ]);

    const canEdit = isPrivateOwner
      || (isWorkspaceAdministrator && isTeamspaceDocument)
      || effectivePermission === 'edit'
      || effectivePermission === 'manage';

    const canManageAccess = isPrivateOwner
      || (isWorkspaceAdministrator && isTeamspaceDocument)
      || effectivePermission === 'manage';

    const canView = (isWorkspaceAdministrator && isTeamspaceDocument)
      || Boolean(effectivePermission)
      || isPrivateOwner;

    return {
      accessScope: this.resolveAccessScope(input),
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

  private resolveAccessScope(context: DocumentAccessContext): DocumentAccessScope {
    if (context.documentTeamspaceId) {
      return 'teamspace';
    }

    if (
      context.documentHasActiveGrants
      || context.directGrantPermission
      || context.ancestorGrantPermission
      || context.workspaceMemberPermission
    ) {
      return 'shared';
    }

    return 'private';
  }

  private resolveGrantPermission(
    permission?: DocumentAccessGrantPermission,
  ): DocumentPermission | undefined {
    switch (permission) {
      case DocumentAccessGrantPermission.MANAGE:
        return 'manage';
      case DocumentAccessGrantPermission.EDIT:
        return 'edit';
      case DocumentAccessGrantPermission.COMMENT:
      case DocumentAccessGrantPermission.VIEW:
        return 'view';
      default:
        return undefined;
    }
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

  private teamspaceRoleToPermission(role: TeamspaceMemberRole): DocumentPermission {
    switch (role) {
      case TeamspaceMemberRole.MANAGER:
        return 'manage';
      case TeamspaceMemberRole.EDITOR:
        return 'edit';
      case TeamspaceMemberRole.VIEWER:
        return 'view';
    }
  }

  private strongestPermission(
    permissions: Array<DocumentPermission | undefined>,
  ): DocumentPermission | undefined {
    const rank: Record<DocumentPermission, number> = {
      none: 0,
      view: 1,
      edit: 2,
      manage: 3,
    };

    return permissions.reduce<DocumentPermission | undefined>((strongest, permission) => {
      if (!permission) {
        return strongest;
      }

      if (!strongest || rank[permission] > rank[strongest]) {
        return permission;
      }

      return strongest;
    }, undefined);
  }
}
