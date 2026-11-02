import { describe, expect, it } from 'vitest';

import { createS3Storage } from '../src/storage/storage';

/**
 * In Docker the server reaches storage as `seaweedfs:8333`, which a browser can't resolve, so the
 * links it hands out are signed for the public address instead.
 */
describe('links a browser can reach', () => {
  process.env.AWS_ACCESS_KEY_ID ??= 'test';
  process.env.AWS_SECRET_ACCESS_KEY ??= 'test';
  const storage = createS3Storage({ region: 'us-east-1', endpoint: 'http://seaweedfs:8333', publicEndpoint: 'http://127.0.0.1:8333', forcePathStyle: true });

  it('signs an upload for the public address', async () => {
    const post = await storage.presignPost({ bucket: 'uploads', key: 'u/1.pdf', contentType: 'application/pdf', maxBytes: 100 });
    expect(post.url).toBe('http://127.0.0.1:8333/uploads');
  });

  it('signs a download for the public address', async () => {
    expect(await storage.presignGet('uploads', 'u/1.pdf')).toMatch(/^http:\/\/127\.0\.0\.1:8333\/uploads\/u\/1\.pdf\?/);
  });
});
