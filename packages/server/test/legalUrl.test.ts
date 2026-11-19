import { describe, expect, it } from 'vitest';

import type { Database } from '../src/db/database';
import { getLegal } from '../src/services/support';

/**
 * A legal document's public address comes from the deployment, never from the stored body: the
 * first seeded version said https://nextkin.app/legal/…, a domain we don't own, and the apps' "Open
 * on the web" and the Play listing follow whatever this returns (toreview §246).
 */
const stored = { key: 'privacy', title: 'Privacy policy', updatedAt: '2026-09-06T00:00:00.000Z', intro: 'Hi.', sections: [], url: 'https://nextkin.app/legal/privacy' };
const db = { withAnonymous: async () => ({ body: stored }) } as unknown as Database;

describe('getLegal', () => {
  it("points the document at this deployment's own legal page", async () => {
    expect((await getLegal(db, 'privacy', 'https://app.nextkin.ai/')).url).toBe('https://app.nextkin.ai/legal/privacy');
    expect((await getLegal(db, 'terms', 'http://localhost:3000')).url).toBe('http://localhost:3000/legal/terms');
  });

  it('keeps the stored address when the deployment has none to give', async () => {
    expect((await getLegal(db, 'privacy')).url).toBe(stored.url);
  });
});
