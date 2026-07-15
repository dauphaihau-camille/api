import { ForbiddenException } from '@nestjs/common';
import { WorkspaceRole } from '../domain/enums/workspace-role.enum';

export function canEditWorkspace(role: WorkspaceRole): boolean {
  return role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN;
}

export function canManageMembers(role: WorkspaceRole): boolean {
  return role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN;
}

export function canManageOwnerAssignments(role: WorkspaceRole): boolean {
  return role === WorkspaceRole.OWNER;
}

export function assertWorkspaceEditor(role: WorkspaceRole): void {
  if (!canEditWorkspace(role)) {
    throw new ForbiddenException('You do not have permission to update this workspace.');
  }
}

export function assertWorkspaceMemberManager(role: WorkspaceRole): void {
  if (!canManageMembers(role)) {
    throw new ForbiddenException('You do not have permission to manage workspace members.');
  }
}

export function assertWorkspaceOwner(role: WorkspaceRole): void {
  if (!canManageOwnerAssignments(role)) {
    throw new ForbiddenException('Only workspace owners can manage owner assignments.');
  }
}
