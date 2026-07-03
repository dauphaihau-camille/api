const RESERVED_WORKSPACE_SLUGS = new Set([
  '',
  'auth',
  'dashboard',
  'features',
  'health',
  'login',
  'logout',
  'metrics',
  'plans',
  'pricing',
  'settings',
  'solutions',
  'workspace',
]);

const WORKSPACE_SLUG_PATTERN = /^(?!-+$)[a-z0-9-]+$/;

export function normalizeWorkspaceSlug(value: string): string {
  return value.trim().toLowerCase();
}

export function slugifyWorkspaceName(value: string): string {
  return normalizeWorkspaceSlug(value)
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'workspace';
}

export function isValidWorkspaceSlug(value: string): boolean {
  return WORKSPACE_SLUG_PATTERN.test(value);
}

export function isReservedWorkspaceSlug(value: string): boolean {
  return RESERVED_WORKSPACE_SLUGS.has(normalizeWorkspaceSlug(value));
}
