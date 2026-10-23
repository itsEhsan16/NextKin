import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import type pg from 'pg';

/**
 * Single-use emailed codes (sign-up confirmation, password reset, email change). Six digits, valid 15 minutes,
 * stored as a hash, at most five guesses each. Issuing a new code invalidates the earlier ones.
 */
export type CodePurpose = 'confirm_sign_up' | 'reset_password' | 'change_email';

const TTL_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const digest = (code: string) => createHash('sha256').update(code).digest();

export async function issueCode(
  db: pg.Pool | pg.PoolClient,
  input: { pool: string; email: string; purpose: CodePurpose; pending?: Record<string, unknown> },
): Promise<string> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await db.query(
    `update local_idp.codes set used_at = now()
      where pool = $1 and email = $2 and purpose = $3 and used_at is null`,
    [input.pool, input.email, input.purpose],
  );
  await db.query(
    `insert into local_idp.codes (pool, email, purpose, code_hash, pending, expires_at)
     values ($1, $2, $3, $4, $5, now() + make_interval(mins => $6))`,
    [input.pool, input.email, input.purpose, digest(code).toString('hex'), input.pending ?? null, TTL_MINUTES],
  );
  return code;
}

/** Consumes the code if it is right; returns its pending data, or null when it is wrong or spent. */
export async function consumeCode(
  db: pg.Pool | pg.PoolClient,
  input: { pool: string; email: string; purpose: CodePurpose; code: string },
): Promise<Record<string, unknown> | null> {
  const { rows } = await db.query<{ id: string; code_hash: string; pending: Record<string, unknown> | null; attempts: number }>(
    `select id, code_hash, pending, attempts from local_idp.codes
      where pool = $1 and email = $2 and purpose = $3 and used_at is null and expires_at > now()
      order by created_at desc limit 1`,
    [input.pool, input.email, input.purpose],
  );
  const row = rows[0];
  if (!row || row.attempts >= MAX_ATTEMPTS || !/^\d{6}$/.test(input.code)) return null;
  const matches = timingSafeEqual(Buffer.from(row.code_hash, 'hex'), digest(input.code));
  if (!matches) {
    await db.query('update local_idp.codes set attempts = attempts + 1 where id = $1', [row.id]);
    return null;
  }
  // The conditional update makes the code single-use even under two concurrent submissions.
  const used = await db.query('update local_idp.codes set used_at = now() where id = $1 and used_at is null', [row.id]);
  return used.rowCount === 1 ? (row.pending ?? {}) : null;
}
