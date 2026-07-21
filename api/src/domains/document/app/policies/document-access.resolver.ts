import { Injectable } from '@nestjs/common';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';

export type DocumentCapabilities = {
  canEdit: boolean;
  canView: boolean;
};

export type DocumentAccessContext = {
  actorUserId: string;
  documentOwnerUserId: string;
  documentTeamspaceId?: string;
  workspaceRole: WorkspaceRole;
};

@Injectable()
export class DocumentAccessResolver {
  resolve(input: WorkspaceRole | DocumentAccessContext): DocumentCapabilities {
    const context = typeof input === 'string'
      ? {
        workspaceRole: input,
      }
      : input;

    const isWorkspaceAdministrator =
      context.workspaceRole === WorkspaceRole.OWNER
      || context.workspaceRole === WorkspaceRole.ADMIN;

    const isPrivateOwner =
      'actorUserId' in context
      && !context.documentTeamspaceId
      && context.actorUserId === context.documentOwnerUserId;

    return {
      canEdit: isWorkspaceAdministrator || isPrivateOwner,
      canView: true,
    };
  }
}
