import { LEGAL_DOCS, LEGAL_VERSION } from '@nextkin/shared/legal';
import { faqFixture } from '@nextkin/shared/mock/fixtures/support';

import type { Database } from '../db/database';
import { SEED_ADMIN_ID } from './reference';

/**
 * Support content (P12-13): the FAQ (version 1) and the two legal documents (version 2, the real
 * text that replaced the placeholder copy; toreview §264), so the backend reads the same as the
 * mock. The newest published version is the one served. Existing rows are left alone, so this is
 * safe on a shared database and runs in `seed --reference-only` too.
 */
export async function seedContent(db: Database): Promise<void> {
  await db.withUser({ userId: SEED_ADMIN_ID, role: 'admin' }, async (tx) => {
    const rows = [
      { key: 'faq' as const, version: 1, body: faqFixture },
      { key: 'terms' as const, version: LEGAL_VERSION, body: LEGAL_DOCS.terms },
      { key: 'privacy' as const, version: LEGAL_VERSION, body: LEGAL_DOCS.privacy },
    ];
    for (const row of rows) {
      await tx
        .insertInto('content_documents')
        .values({ key: row.key, version: row.version, body: JSON.stringify(row.body), published_at: new Date(), created_by: SEED_ADMIN_ID })
        .onConflict((oc) => oc.columns(['key', 'version']).doNothing())
        .execute();
    }
  });
}
