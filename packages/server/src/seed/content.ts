import { legalFixture } from '@nextkin/shared/mock/fixtures/legal';
import { faqFixture } from '@nextkin/shared/mock/fixtures/support';

import type { Database } from '../db/database';
import { SEED_ADMIN_ID } from './reference';

/**
 * Support content, version 1 (P12-13): the FAQ and the two legal documents the apps show today, so
 * the backend reads the same as the mock. The legal text is the product's placeholder copy until
 * counsel's drafts replace it as version 2 (M3-11). Existing rows are left alone.
 */
export async function seedContent(db: Database): Promise<void> {
  await db.withUser({ userId: SEED_ADMIN_ID, role: 'admin' }, async (tx) => {
    const rows = [
      { key: 'faq' as const, body: faqFixture },
      { key: 'terms' as const, body: legalFixture.terms },
      { key: 'privacy' as const, body: legalFixture.privacy },
    ];
    for (const row of rows) {
      await tx
        .insertInto('content_documents')
        .values({ key: row.key, version: 1, body: JSON.stringify(row.body), published_at: new Date(), created_by: SEED_ADMIN_ID })
        .onConflict((oc) => oc.columns(['key', 'version']).doNothing())
        .execute();
    }
  });
}
