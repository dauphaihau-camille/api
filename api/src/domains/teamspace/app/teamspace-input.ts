import { TeamspaceNameTooShortError } from '../domain/errors/teamspace-domain.error';

export function normalizeTeamspaceName(name: string): string {
  const normalized = name.trim();

  if (normalized.length < 2) {
    throw new TeamspaceNameTooShortError();
  }

  return normalized;
}

export function normalizeTeamspaceDescription(value?: string): string | undefined {
  const normalized = value?.trim();

  return normalized ? normalized : undefined;
}
