export type ExpandedDocumentIdsByScope = Record<string, string[]>;

export interface WorkspacePreferenceSummary {
  workspaceId: string;
  navigation: {
    expandedDocumentIdsByScope: ExpandedDocumentIdsByScope;
  };
  activity: {
    lastActiveAt: Date | null;
  };
}

export interface UpdateWorkspacePreferenceInput {
  navigation: {
    expandedDocumentIdsByScope: ExpandedDocumentIdsByScope;
  };
}
