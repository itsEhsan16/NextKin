import Valkey from 'iovalkey';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ValkeyIncrementalCache } from '../../src/cache/nextCacheHandler';
import { loadConfig } from '../../src/config';

/**
 * The ISR cache on Valkey (P11-07, M0-15): two web tasks share one cache, a tag revalidated on one
 * is stale on both, and an app page's Buffers and Maps survive the round trip.
 */
const config = loadConfig();
let one: Valkey;
let two: Valkey;
beforeAll(() => {
  one = new Valkey(config.VALKEY_URL);
  two = new Valkey(config.VALKEY_URL);
});
afterAll(async () => {
  await one.quit();
  await two.quit();
});

describe('the Next ISR cache handler on Valkey', () => {
  it('shares entries across tasks and revalidates a tag everywhere', async () => {
    const prefix = `isr-test:${randomUUID()}:`;
    const taskA = new ValkeyIncrementalCache(one, prefix);
    const taskB = new ValkeyIncrementalCache(two, prefix);
    const page = { kind: 'APP_PAGE', html: '<p>Kubernetes</p>', rscData: Buffer.from('rsc-bytes'), segmentData: new Map([['/skills', Buffer.from('seg')]]), headers: { 'x-next-cache-tags': 'skills,skill:kubernetes' }, status: 200 };

    await taskA.set('/skills/kubernetes', page, { tags: [] });
    const read = (await taskB.get('/skills/kubernetes'))!;
    expect(read).not.toBeNull();
    const value = read.value as typeof page;
    expect(Buffer.isBuffer(value.rscData) && value.rscData.toString()).toBe('rsc-bytes');
    expect(value.segmentData.get('/skills')?.toString()).toBe('seg');

    // A curator publishes an edit: the tag is revalidated on task B, and task A misses too.
    await new Promise((resolve) => setTimeout(resolve, 5));
    await taskB.revalidateTag('skill:kubernetes');
    expect(await taskA.get('/skills/kubernetes')).toBeNull();

    // The regenerated page is fresh again for both.
    await new Promise((resolve) => setTimeout(resolve, 5));
    await taskA.set('/skills/kubernetes', { ...page, html: '<p>Kubernetes, edited</p>' }, { tags: [] });
    expect(((await taskB.get('/skills/kubernetes'))!.value as typeof page).html).toContain('edited');
    expect(await taskB.get('/skills/missing')).toBeNull();
  });
});
