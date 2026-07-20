import type { WorkspaceRole } from '../../../src/domains/workspace/domain/enums/workspace-role.enum';

export type SeedUserFixture = {
  email: string;
  displayName: string;
  role: 'admin' | 'member';
};

export type TeamspaceTemplate = {
  key: string;
  name: string;
  description: string;
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
