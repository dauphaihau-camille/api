import {
  DeleteBucketCommand,
  DeleteObjectCommand,
  ListBucketsCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import type { MinioStorageConfig } from '~/config/storage.config';
import { MinioStorageService } from '~/modules/shared/storage/infra/minio-storage.service';

function readMinioEnv() {
  return {
    endpoint: process.env.STORAGE_OBJECT_STORAGE_ENDPOINT ??
      process.env.STORAGE_MINIO_ENDPOINT,
    region: process.env.STORAGE_OBJECT_STORAGE_REGION ??
      process.env.STORAGE_MINIO_REGION ??
      'us-east-1',
    bucketPrefix: process.env.STORAGE_OBJECT_STORAGE_BUCKET ??
      process.env.STORAGE_MINIO_BUCKET,
    accessKey: process.env.STORAGE_OBJECT_STORAGE_ACCESS_KEY ??
      process.env.STORAGE_MINIO_ACCESS_KEY,
    secretKey: process.env.STORAGE_OBJECT_STORAGE_SECRET_KEY ??
      process.env.STORAGE_MINIO_SECRET_KEY,
    forcePathStyle: (
      process.env.STORAGE_OBJECT_STORAGE_FORCE_PATH_STYLE ??
      process.env.STORAGE_MINIO_FORCE_PATH_STYLE ??
      'true'
    ) === 'true',
  };
}

describe('MinioStorageService integration', () => {
  let client: S3Client | undefined;
  let bucketName: string | undefined;
  let objectKey: string | undefined;
  let skipReason: string | undefined;
  let endpoint: string | undefined;
  let region = 'us-east-1';
  let bucketPrefix: string | undefined;
  let accessKey: string | undefined;
  let secretKey: string | undefined;
  let forcePathStyle = true;

  beforeAll(async () => {
    const env = readMinioEnv();
    const missingKeys = [
      ['STORAGE_OBJECT_STORAGE_ENDPOINT or STORAGE_MINIO_ENDPOINT', env.endpoint],
      ['STORAGE_OBJECT_STORAGE_BUCKET or STORAGE_MINIO_BUCKET', env.bucketPrefix],
      ['STORAGE_OBJECT_STORAGE_ACCESS_KEY or STORAGE_MINIO_ACCESS_KEY', env.accessKey],
      ['STORAGE_OBJECT_STORAGE_SECRET_KEY or STORAGE_MINIO_SECRET_KEY', env.secretKey],
    ].filter(([, value]) => !value).map(([key]) => key);

    if (missingKeys.length > 0) {
      throw new Error(
        `Missing MinIO integration env: ${missingKeys.join(', ')}`,
      );
    }

    endpoint = env.endpoint;
    region = env.region;
    bucketPrefix = env.bucketPrefix;
    accessKey = env.accessKey;
    secretKey = env.secretKey;
    forcePathStyle = env.forcePathStyle;

    client = new S3Client({
      region,
      endpoint,
      forcePathStyle,
      credentials: {
        accessKeyId: accessKey!,
        secretAccessKey: secretKey!,
      },
    });

    try {
      await client.send(new ListBucketsCommand({}));
    }
    catch (error) {
      skipReason = `Skipping MinioStorageService integration: MinIO is not reachable at ${endpoint}. ${String(error)}`;
      client.destroy();
      client = undefined;
      throw new Error(skipReason);
    }
  }, 10_000);

  afterAll(async () => {
    if (client && bucketName) {
      if (objectKey) {
        await client.send(new DeleteObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
        })).catch(() => undefined);
      }

      await client.send(new DeleteBucketCommand({
        Bucket: bucketName,
      })).catch(() => undefined);
    }

    client?.destroy();
  });

  it('stores, reads, and deletes an object in an isolated MinIO bucket', async () => {
    if (!client) {
      throw new Error(skipReason ?? 'MinIO client was not initialized.');
    }

    const runId = randomUUID().replaceAll('-', '').slice(0, 16);
    const safeBucketPrefix = bucketPrefix!
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 42);

    bucketName = `${safeBucketPrefix || 'app-files'}-int-${runId}`;
    objectKey = `integration/minio-storage/${runId}/hello.txt`;

    const storageConfig: MinioStorageConfig = {
      driver: 'minio',
      endpoint: endpoint!,
      region,
      bucket: bucketName,
      accessKey: accessKey!,
      secretKey: secretKey!,
      forcePathStyle,
    };
    const storage = new MinioStorageService(storageConfig, client);
    const body = `hello minio integration ${runId}`;

    try {
      await expect(storage.exists(objectKey)).resolves.toBe(false);

      await expect(storage.putObject({
        key: objectKey,
        body,
        contentType: 'text/plain',
      })).resolves.toMatchObject({
        key: objectKey,
        size: Buffer.byteLength(body),
        contentType: 'text/plain',
      });

      await expect(storage.exists(objectKey)).resolves.toBe(true);
      await expect(storage.getObject(objectKey)).resolves.toEqual(
        Buffer.from(body),
      );

      await expect(storage.deleteObject(objectKey)).resolves.toBeUndefined();
      await expect(storage.exists(objectKey)).resolves.toBe(false);
    }
    finally {
      await client.send(new DeleteObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
      })).catch(() => undefined);
    }
  }, 20_000);
});
