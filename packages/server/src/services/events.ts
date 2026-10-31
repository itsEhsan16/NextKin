import type { ProductEvent } from '@nextkin/shared/schemas/events';

import type { Database, Identity } from '../db/database';

/**
 * Usage events (owner, 2026-10-31; V2 §8.5). Kept on our own server, so no analytics company ever
 * sees them. Someone who switched "Share anonymized data" off records nothing, and the whole batch
 * is dropped quietly: the client has no reason to treat that as an error.
 */

export const RETENTION_MONTHS = 13;

/** The platforms the client header names; anything else is not one of our apps. */
const PLATFORMS = new Set(['ios', 'android', 'web']);

interface ClientInfo {
  platform: string | undefined;
  version: string | undefined;
}

export async function recordEvents(db: Database, identity: Identity, events: ProductEvent[], client: ClientInfo): Promise<void> {
  const platform = client.platform?.toLowerCase();
  if (!platform || !PLATFORMS.has(platform)) return;
  await db.withUser(identity, async (tx) => {
    const settings = await tx.selectFrom('user_settings').select('privacy_settings').where('user_id', '=', identity.userId).executeTakeFirst();
    if ((settings?.privacy_settings as { shareAnonymizedData?: boolean } | null)?.shareAnonymizedData === false) return;
    await tx
      .insertInto('product_events')
      .values(
        events.map((event) => ({
          user_id: identity.userId,
          name: event.name,
          platform,
          app_version: client.version?.slice(0, 40) ?? null,
          properties: JSON.stringify(event.properties ?? {}),
          occurred_at: event.at,
        })),
      )
      .execute();
  });
}

/** Thirteen months covers a year-on-year view, and no more. */
export async function purgeEvents(db: Database, now = new Date()): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
  const result = await db.withSystem('maintenance: delete usage events past retention', (tx) => tx.deleteFrom('product_events').where('created_at', '<', cutoff).executeTakeFirst());
  return Number(result.numDeletedRows);
}
