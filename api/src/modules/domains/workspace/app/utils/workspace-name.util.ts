import { BadRequestException } from '@nestjs/common';

export function normalizeWorkspaceName(value: string): string {
  const normalized = value.trim();

  if (normalized.length < 2) {
    throw new BadRequestException('Workspace name must be at least 2 characters.');
  }

  return normalized;
}
