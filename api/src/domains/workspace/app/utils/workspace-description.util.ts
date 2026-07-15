export function normalizeWorkspaceDescription(value?: string): string | undefined {
  const normalized = value?.trim();

  return normalized ? normalized : undefined;
}
