import type { WorkspaceRole } from '../../../src/domains/workspace/domain/enums/workspace-role.enum';
import type { TeamspaceAccessMode } from '../../../src/domains/teamspace/domain/enums/teamspace-access-mode.enum';
import type { TeamspaceMemberRole } from '../../../src/domains/teamspace/domain/enums/teamspace-member-role.enum';
import type { DocumentAccessGrantPermission } from '../../../src/domains/document/domain/enums/document-access-grant-permission.enum';

export type SeedUserFixture = {
  email: string;
  displayName: string;
  role: 'admin' | 'member';
};

export type TeamspaceTemplate = {
  key: string;
  name: string;
  description: string;
  accessMode?: TeamspaceAccessMode;
  members?: TeamspaceMemberTemplate[];
};

export type TeamspaceMemberTemplate = {
  email: string;
  role: TeamspaceMemberRole;
};

export type WorkspaceMemberTemplate = {
  email: string;
  role: WorkspaceRole;
};

export type WorkspaceSubscriptionSeedState =
  | 'free'
  | 'plus_active'
  | 'plus_canceling'
  | 'plus_past_due';

export type WorkspaceSubscriptionTemplate = {
  state: WorkspaceSubscriptionSeedState;
  replicaStates?: Record<number, WorkspaceSubscriptionSeedState>;
};

export type DocumentBlueprint = {
  key: string;
  title: string;
  kind: 'landing' | 'hub' | 'spec' | 'notes' | 'runbook' | 'roadmap' | 'wiki' | 'tracker';
  summary: string;
  teamspaceKey?: string;
  children?: DocumentBlueprint[];
};

export type DocumentAccessGrantTemplate = {
  documentKey: string;
  userEmail: string;
  permission: DocumentAccessGrantPermission;
  grantedByEmail?: string;
};

export type DocumentAccessSettingTemplate = {
  documentKey: string;
  workspaceMemberPermission?: DocumentAccessGrantPermission;
  updatedByEmail?: string;
};

export type WorkspaceTemplate = {
  key: string;
  name: string;
  description: string;
  members: WorkspaceMemberTemplate[];
  subscription?: WorkspaceSubscriptionTemplate;
  teamspaces: TeamspaceTemplate[];
  documents: DocumentBlueprint[];
  documentAccessGrants?: DocumentAccessGrantTemplate[];
  documentAccessSettings?: DocumentAccessSettingTemplate[];
};
