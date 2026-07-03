import type { WorkspacePreferenceEntity } from '../../infra/persistence/entities/workspace-preference.entity';

export abstract class WorkspacePreferenceRepository {
  abstract findByWorkspaceAndUser(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspacePreferenceEntity | null>;
  abstract save(input: {
    workspaceId: string;
    userId: string;
    expandedDocumentIds: string[];
  }): Promise<WorkspacePreferenceEntity>;
}
