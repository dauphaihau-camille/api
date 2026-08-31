import { createHash } from 'node:crypto';
import type { SeedUserSummary } from './realistic-seed.types';

export function formatDuration(ms: number): string {
  if (ms < 1_000) {
    return `${ms}ms`;
  }

  return `${(ms / 1_000).toFixed(1)}s`;
}

export function resolvePositiveInteger(env: NodeJS.ProcessEnv, key: string, fallback: number, minimum = 0): number {
  const value = env[key];

  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${key} must be an integer >= ${minimum}`);
  }

  return parsed;
}

export function buildSeededPublicId(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, 32);
}

export function buildSeededProviderId(prefix: string, seed: string): string {
  return `${prefix}_${createHash('sha256').update(seed).digest('hex').slice(0, 24)}`;
}

export function findUsersByEmail(users: SeedUserSummary[], emails: string[]): SeedUserSummary[] {
  const usersByEmail = new Map(users.map((user) => [user.email, user]));

  return emails.flatMap((email) => {
    const user = usersByEmail.get(email);
    return user ? [user] : [];
  });
}

export function selectExtraMembers(
  users: SeedUserSummary[],
  takenUserIds: Set<string>,
  count: number,
): SeedUserSummary[] {
  if (count === 0) {
    return [];
  }

  const availableUsers = users.filter((user) => !takenUserIds.has(user.id));
  return availableUsers.slice(0, count);
}
