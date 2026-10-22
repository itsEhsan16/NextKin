import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { computeSkillTrends, importKbForReview } from '../../src/services/skillsExplorer';
import { startHarness, type Harness } from './fixtures/authHarness';
import { createUser, deleteUsers } from './fixtures/pipeline';

/**
 * The Skills Explorer's backend (P11-07; V2 §7.14): only published entries are public (an imported,
 * unreviewed one is a 404), a curator's publish shows at once, related entries show only when
 * published, trending needs at least the threshold of distinct users, and the sitemap lists
 * published entries only.
 */
let h: Harness;
const users: string[] = [];
const curator = () => ({ userId: randomUUID(), role: 'curator' as const });
const slug = `zyntex-${randomUUID().slice(0, 8)}`;
const name = `Zyntex ${slug.slice(7)}`;

beforeAll(async () => {
  h = await startHarness({});
  await importKbForReview(h.db);
});
afterAll(async () => {
  await h.db.withUser(curator(), (tx) => tx.deleteFrom('technologies').where('slug', '=', slug).execute());
  await h.db.withUser(curator(), (tx) => tx.updateTable('technologies').set({ review_status: 'llm_seeded', source_citation: null }).where('slug', '=', 'kubernetes').execute());
  await deleteUsers(h.db, users);
  await h.close();
});

const get = (path: string) => h.app.request(`/api/v1/public${path}`);

describe('the Skills Explorer API (P11-07)', () => {
  it('shows published entries only, and a publish appears at once', async () => {
    // The import is unpublished: the entry exists, the public cannot see it.
    expect((await get('/skills/kubernetes')).status).toBe(404);
    expect(((await (await get('/skills?q=kubernetes')).json()) as { data: unknown[] }).data).toEqual([]);

    await h.db.withUser(curator(), (tx) => tx.updateTable('technologies').set({ review_status: 'published', source_citation: 'https://www.wikidata.org/wiki/Q22661306' }).where('slug', '=', 'kubernetes').execute());
    const res = await get('/skills/kubernetes');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('max-age');
    const detail = (await res.json()) as { name: string; releaseYear: number; related: { slug: string }[] };
    expect(detail).toMatchObject({ name: 'Kubernetes', releaseYear: 2014 });
    // Docker is related in the KB but unpublished, so it is not shown.
    expect(detail.related.map((r) => r.slug)).not.toContain('docker');

    const sitemap = await (await get('/sitemap.xml')).text();
    expect(sitemap).toContain('/skills/kubernetes</loc>');
    expect(sitemap).not.toContain('/skills/docker</loc>');
  });

  it('lists a technology as trending only when enough distinct users added it', async () => {
    await h.db.withUser(curator(), (tx) =>
      tx.insertInto('technologies').values({ name, slug, category: 'tool', review_status: 'published', release_year: 2020, source_citation: 'https://example.test/zyntex', dataset_version: 1 }).execute(),
    );
    const add = async (n: number) => {
      for (let i = 0; i < n; i++) {
        const userId = await createUser(h.db, users);
        await h.db.withUser({ userId, role: 'user' }, (tx) => tx.insertInto('profile_skills').values({ user_id: userId, raw_name: name.toLowerCase() }).execute());
      }
    };
    await add(9);
    await computeSkillTrends(h.db, { minUsers: 10 });
    let trending = ((await (await get('/skills/trending')).json()) as { data: { slug: string }[] }).data;
    expect(trending.map((t) => t.slug)).not.toContain(slug);

    await add(1);
    await computeSkillTrends(h.db, { minUsers: 10 });
    trending = ((await (await get('/skills/trending')).json()) as { data: { slug: string; rank: number }[] }).data;
    expect(trending.map((t) => t.slug)).toContain(slug);
    // No count, no user: the rank is all a trending row says.
    expect(Object.keys(trending[0]!).sort()).toEqual(['category', 'computedAt', 'name', 'rank', 'slug']);
  }, 60_000);
});
