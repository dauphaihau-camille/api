import { WorkspaceRole } from '../domain/enums/workspace-role.enum';
import {
  WorkspaceMemberManagerPermissionDeniedError,
  WorkspaceOwnerPermissionDeniedError,
  WorkspacePermissionDeniedError,
} from './errors/workspace-app.error';

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
    throw new WorkspacePermissionDeniedError();
  }
}

export function assertWorkspaceMemberManager(role: WorkspaceRole): void {
  if (!canManageMembers(role)) {
    throw new WorkspaceMemberManagerPermissionDeniedError();
  }
}

export function assertWorkspaceOwner(role: WorkspaceRole): void {
  if (!canManageOwnerAssignments(role)) {
    throw new WorkspaceOwnerPermissionDeniedError();
  }
}
