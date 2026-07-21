import { Injectable } from '@nestjs/common';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';

export type DocumentCapabilities = {
  canEdit: boolean;
  canView: boolean;
};

@Injectable()
export class DocumentAccessResolver {
  resolve(workspaceRole: WorkspaceRole): DocumentCapabilities {
    return {
      canEdit:
        workspaceRole === WorkspaceRole.OWNER
        || workspaceRole === WorkspaceRole.ADMIN,
      canView: true,
    };
  }
}
