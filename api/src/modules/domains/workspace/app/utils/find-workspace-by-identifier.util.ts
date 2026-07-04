import type { WorkspaceSummary } from '../contracts/workspace.contract';

export function findWorkspaceByIdentifier(
  workspaces: readonly WorkspaceSummary[],
  workspaceIdentifier: string,
): WorkspaceSummary | undefined {
  const normalizedIdentifier = workspaceIdentifier.trim().toLowerCase();

  return workspaces.find((workspace) =>
    workspace.id === workspaceIdentifier || workspace.slug === normalizedIdentifier,
  );
}
