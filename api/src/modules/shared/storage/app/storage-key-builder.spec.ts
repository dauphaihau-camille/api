import {
  buildStorageObjectKey,
  resolveImageExtension,
  resolveStorageEnvironmentSegment,
} from './storage-key-builder';

describe('storage key builder', () => {
  it('builds structured object keys with environment and visibility prefixes', () => {
    const key = buildStorageObjectKey({
      env: 'production',
      visibility: 'public',
      scope: ['users', 'user-1'],
      segments: ['avatars', 'original'],
      filename: 'asset-1',
      extension: 'webp',
    });

    expect(key).toBe(
      'prod/public/users/user-1/avatars/original/asset-1.webp',
    );
  });

  it('normalizes runtime environment names', () => {
    expect(resolveStorageEnvironmentSegment('development')).toBe('dev');
    expect(resolveStorageEnvironmentSegment('production')).toBe('prod');
    expect(resolveStorageEnvironmentSegment('test')).toBe('test');
  });

  it('maps supported image content types to extensions', () => {
    expect(resolveImageExtension('image/jpeg')).toBe('jpg');
    expect(resolveImageExtension('image/png')).toBe('png');
    expect(resolveImageExtension('image/webp')).toBe('webp');
  });

  it('rejects empty or traversal-like key segments', () => {
    expect(() =>
      buildStorageObjectKey({
        visibility: 'private',
        scope: ['users', '..'],
        filename: 'asset-1',
        extension: 'png',
      }),
    ).toThrow('invalid');
  });
});
