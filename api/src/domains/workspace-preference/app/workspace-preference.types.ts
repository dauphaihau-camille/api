export interface WorkspacePreferenceSummary {
  workspaceId: string;
  navigation: {
    expandedDocumentIds: string[];
  };
  activity: {
    lastActiveAt: Date | null;
  };
}

export interface UpdateWorkspacePreferenceInput {
  navigation: {
    expandedDocumentIds: string[];
  };
}
