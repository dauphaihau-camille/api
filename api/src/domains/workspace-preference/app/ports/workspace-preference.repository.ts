import type { WorkspacePreferenceEntity } from '../../infra/persistence/entities/workspace-preference.entity';
import type { ExpandedDocumentIdsByScope } from '../workspace-preference.types';

export abstract class WorkspacePreferenceRepository {
  abstract findByWorkspaceAndUser(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspacePreferenceEntity | null>;
  abstract findLastActiveForUser(userId: string): Promise<WorkspacePreferenceEntity | null>;
  abstract save(input: {
    workspaceId: string;
    userId: string;
    expandedDocumentIdsByScope: ExpandedDocumentIdsByScope;
  }): Promise<WorkspacePreferenceEntity>;
  abstract markAsLastActive(input: {
    workspaceId: string;
    userId: string;
  }): Promise<WorkspacePreferenceEntity>;
}
