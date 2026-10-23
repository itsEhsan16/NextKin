import type { ProfileLink } from '@nextkin/shared/models';
import type { Database, Identity } from '../db/database';
import { decodeCursor, encodeCursor } from '../http/cursor';
import { errors } from '../http/errors';

/**
 * Profile links (profileRepo.upsertLink / removeLink, and the list behind getProfile). The first
 * resource with a paginated list, an idempotent create and a delete, so it exercises the whole
 * API kernel (ImBackendImplementationPlan P3 exit gate).
 */

export interface LinkPage {
  items: ProfileLink[];
  nextCursor?: string;
}

const toLink = (row: { id: string; label: string; url: string; kind: string | null }): ProfileLink => ({
  id: row.id,
  label: row.label,
  url: row.url,
  ...(row.kind ? { kind: row.kind as ProfileLink['kind'] } : {}),
});

export async function listLinks(db: Database, identity: Identity, options: { limit: number; cursor?: string; cursorSecret: string }): Promise<LinkPage> {
  const after = options.cursor ? decodeCursor(options.cursor, options.cursorSecret) : null;
  const rows = await db.withUser(identity, (tx) => {
    let query = tx
      .selectFrom('profile_links')
      .select(['id', 'label', 'url', 'kind'])
      .where('user_id', '=', identity.userId)
      .orderBy('id')
      .limit(options.limit + 1);
    // UUIDv7 ids are time-ordered, so the id alone is a stable keyset.
    if (after) query = query.where('id', '>', after.i);
    return query.execute();
  });
  const page = rows.slice(0, options.limit);
  const last = page.at(-1);
  return {
    items: page.map(toLink),
    ...(rows.length > options.limit && last ? { nextCursor: encodeCursor({ k: last.id, i: last.id }, options.cursorSecret) } : {}),
  };
}

export async function createLink(db: Database, identity: Identity, input: Omit<ProfileLink, 'id'>): Promise<ProfileLink> {
  return db.withUser(identity, async (tx) => {
    const profile = await tx.selectFrom('profiles').select('user_id').where('user_id', '=', identity.userId).executeTakeFirst();
    if (!profile) throw errors.notFound('profile');
    const count = await tx
      .selectFrom('profile_links')
      .select((eb) => eb.fn.countAll<number>().as('n'))
      .where('user_id', '=', identity.userId)
      .executeTakeFirstOrThrow();
    const row = await tx
      .insertInto('profile_links')
      .values({ user_id: identity.userId, label: input.label, url: input.url, kind: input.kind ?? null, sort_order: Number(count.n) })
      .returning(['id', 'label', 'url', 'kind'])
      .executeTakeFirstOrThrow();
    return toLink(row);
  });
}

export async function deleteLink(db: Database, identity: Identity, id: string): Promise<void> {
  const result = await db.withUser(identity, (tx) =>
    tx.deleteFrom('profile_links').where('id', '=', id).where('user_id', '=', identity.userId).executeTakeFirst(),
  );
  if (Number(result.numDeletedRows) === 0) throw errors.notFound('link');
}
