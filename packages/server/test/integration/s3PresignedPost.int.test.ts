import { DeleteObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { afterAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config';

/**
 * The S3 stand-in decision test (ImBackendImplementationPlan P1-04). Uploads use presigned POST,
 * not PUT, because only POST policy conditions can enforce a maximum size (spec §9.4.3, G6). A
 * stand-in that ignores `content-length-range` would let local code pass what real S3 rejects,
 * so the stand-in is chosen by this test: SeaweedFS first, then RustFS, then a pinned MinIO.
 */
const config = loadConfig();
const s3 = new S3Client({
  region: config.AWS_REGION,
  endpoint: config.S3_ENDPOINT,
  forcePathStyle: config.S3_FORCE_PATH_STYLE,
});
const Bucket = config.S3_BUCKET_UPLOADS;
const MAX_BYTES = 1024;
const written: string[] = [];

async function postUpload(key: string, bytes: number, contentType = 'application/pdf') {
  const { url, fields } = await createPresignedPost(s3, {
    Bucket,
    Key: key,
    Conditions: [
      ['content-length-range', 1, MAX_BYTES],
      ['eq', '$Content-Type', 'application/pdf'],
      ['starts-with', '$key', 'users/test-user/'],
    ],
    Fields: { 'Content-Type': contentType },
    Expires: 60,
  });
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  form.append('file', new Blob([new Uint8Array(bytes)]), 'upload.pdf');
  written.push(key);
  return fetch(url, { method: 'POST', body: form });
}

async function exists(Key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket, Key }));
    return true;
  } catch {
    return false;
  }
}

afterAll(async () => {
  for (const Key of written) await s3.send(new DeleteObjectCommand({ Bucket, Key })).catch(() => {});
});

describe('S3 stand-in: presigned POST policy enforcement', () => {
  it('accepts an upload inside the policy', async () => {
    const key = `users/test-user/ok-${Date.now()}.pdf`;
    const res = await postUpload(key, 512);
    expect(res.status).toBeLessThan(300);
    expect(await exists(key)).toBe(true);
  });

  it('rejects an upload larger than content-length-range', async () => {
    const key = `users/test-user/too-big-${Date.now()}.pdf`;
    const res = await postUpload(key, MAX_BYTES * 4);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await exists(key)).toBe(false);
  });

  it('rejects a content type the policy does not allow', async () => {
    const key = `users/test-user/wrong-type-${Date.now()}.pdf`;
    const res = await postUpload(key, 512, 'text/html');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await exists(key)).toBe(false);
  });

  it('rejects a key outside the user prefix', async () => {
    const key = `users/someone-else/escape-${Date.now()}.pdf`;
    const res = await postUpload(key, 512);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await exists(key)).toBe(false);
  });
});
