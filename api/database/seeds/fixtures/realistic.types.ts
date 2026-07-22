import type { WorkspaceRole } from '../../../src/domains/workspace/domain/enums/workspace-role.enum';
import type { TeamspaceAccessMode } from '../../../src/domains/teamspace/domain/enums/teamspace-access-mode.enum';
import type { TeamspaceMemberRole } from '../../../src/domains/teamspace/domain/enums/teamspace-member-role.enum';

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

export type DocumentBlueprint = {
  key: string;
  title: string;
  kind: 'landing' | 'hub' | 'spec' | 'notes' | 'runbook' | 'roadmap' | 'wiki' | 'tracker';
  summary: string;
  teamspaceKey?: string;
  children?: DocumentBlueprint[];
};

export type WorkspaceTemplate = {
  key: string;
  name: string;
  description: string;
  members: WorkspaceMemberTemplate[];
  teamspaces: TeamspaceTemplate[];
  documents: DocumentBlueprint[];
};
