import type { BuildStorageObjectKeyInput } from './storage-key.types';

export function buildStorageObjectKey(
  input: BuildStorageObjectKeyInput,
): string {
  const env = resolveStorageEnvironmentSegment(input.env);
  const extension = normalizeExtension(input.extension);
  const filename = normalizeSegment(input.filename, 'Storage filename is required.');
  const scope = normalizeSegments(
    input.scope,
    'Storage scope must include at least one segment.',
  );
  const segments = normalizeSegments(input.segments ?? []);

  return [
    env,
    input.visibility,
    ...scope,
    ...segments,
    `${filename}.${extension}`,
  ].join('/');
}

export function resolveStorageEnvironmentSegment(
  nodeEnv?: string,
): 'dev' | 'prod' | 'test' {
  switch ((nodeEnv ?? 'development').trim().toLowerCase()) {
    case 'production':
    case 'prod':
      return 'prod';
    case 'test':
      return 'test';
    default:
      return 'dev';
  }
}

export function resolveImageExtension(
  contentType: string,
): 'jpg' | 'png' | 'webp' {
  switch (contentType.trim().toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      throw new Error(`Unsupported image content type "${contentType}".`);
  }
}

function normalizeExtension(extension: string): string {
  const normalized = extension.trim().toLowerCase().replace(/^\./, '');

  if (!normalized) {
    throw new Error('Storage object extension is required.');
  }

  return normalized;
}

function normalizeSegments(segments: string[], emptyMessage?: string): string[] {
  const normalized = segments
    .map((segment) =>
      normalizeSegment(segment, 'Storage key segment is required.'),
    );

  if (normalized.length === 0 && emptyMessage) {
    throw new Error(emptyMessage);
  }

  return normalized;
}

function normalizeSegment(segment: string, emptyMessage: string): string {
  const normalized = segment.trim().replace(/^\/+|\/+$/g, '');

  if (!normalized) {
    throw new Error(emptyMessage);
  }

  if (
    normalized === '.'
    || normalized === '..'
    || normalized.includes('//')
    || normalized.split('/').some((part) => part === '.' || part === '..' || part === '')
  ) {
    throw new Error(`Storage key segment "${segment}" is invalid.`);
  }

  return normalized;
}
