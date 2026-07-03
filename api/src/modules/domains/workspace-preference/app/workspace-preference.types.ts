export interface WorkspacePreferenceSummary {
  workspaceId: string;
  navigation: {
    expandedDocumentIds: string[];
  };
}

export interface UpdateWorkspacePreferenceInput {
  navigation: {
    expandedDocumentIds: string[];
  };
}
