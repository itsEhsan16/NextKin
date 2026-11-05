import { sql } from 'kysely';

import { parseCidr, networkAllows, type AllowedNetwork } from '../../auth/staff/networks';
import { readAdminPolicy, type StaffAuth } from '../../auth/staff/service';
import type { Database } from '../../db/database';
import { errors } from '../../http/errors';
import { RETENTION_MONTHS as EVENT_MONTHS } from '../events';
import { TRASH_DAYS } from '../resumes';
import { writeAudit, type RequestMeta } from './audit';
import type { Staff } from './permissions';

/**
 * Settings (Figma 409:1500): the portal's access policy, which a Super Admin edits, and the signed-in
 * member's own authenticator and backup codes, which every member manages (toreview §171.13).
 */

export const SESSION_TIMEOUTS = [15, 30, 60, 120] as const;

/**
 * What the server actually keeps, from the jobs that purge it (`scheduler/scheduler.ts`). Nothing is
 * claimed that no job enforces: security events have no purge yet, so they say so.
 */
const RETENTION = [
  { label: 'Audit log', value: 'Kept indefinitely, append-only' },
  { label: 'Security events', value: 'Kept; no purge job yet' },
  { label: 'Deleted accounts', value: 'Purged at the next daily sweep' },
  { label: 'Deleted resumes', value: `In the trash ${TRASH_DAYS} days, then purged` },
  { label: 'Usage events', value: `${EVENT_MONTHS} months, then deleted` },
];

export async function readSettings(db: Database, staff: Staff, accountId: string | undefined, ip: string | null) {
  const policy = await readAdminPolicy(db);
  const own = await db.withSystem(`admin ${staff.identity.userId}: read own staff security`, async (tx) => {
    const account = await tx
      .selectFrom('staff_accounts')
      .select(['id', 'totp_added_at', 'totp_last_used_at', 'last_sign_in_at', 'last_sign_in_ip'])
      .where(accountId ? 'id' : 'user_id', '=', accountId ?? staff.identity.userId)
      .executeTakeFirst();
    if (!account) return null;
    const codes = await tx
      .selectFrom('staff_backup_codes')
      .select([sql<number>`count(*)::int`.as('total'), sql<number>`(count(*) filter (where used_at is null))::int`.as('unused')])
      .where('staff_id', '=', account.id)
      .executeTakeFirstOrThrow();
    return { account, codes };
  });
  const iso = (value: Date | null | undefined) => (value ? value.toISOString() : null);
  return {
    requireMfa: true as const,
    authenticator: own?.account.totp_added_at
      ? { addedAt: iso(own.account.totp_added_at), lastUsedAt: iso(own.account.totp_last_used_at ?? own.account.totp_added_at) }
      : null,
    backupCodes: { unused: own?.codes.unused ?? 0, total: own?.codes.total ?? 0 },
    sessionTimeoutMinutes: policy.sessionTimeoutMinutes,
    reauthForSensitive: policy.reauthForSensitive,
    allowedNetworks: policy.allowedNetworks,
    currentIp: ip,
    lastSignIn: own?.account.last_sign_in_at ? { at: iso(own.account.last_sign_in_at), ip: own.account.last_sign_in_ip } : null,
    retention: RETENTION,
  };
}

export interface SettingsPatch {
  sessionTimeoutMinutes?: number;
  reauthForSensitive?: boolean;
  allowedNetworks?: AllowedNetwork[];
}

export async function updateSettings(db: Database, staff: Staff, patch: SettingsPatch, ip: string | null, meta: RequestMeta) {
  if (patch.sessionTimeoutMinutes !== undefined && !(SESSION_TIMEOUTS as readonly number[]).includes(patch.sessionTimeoutMinutes)) {
    throw errors.validation({ sessionTimeoutMinutes: 'one of 15, 30, 60, 120' }, 'Choose 15, 30, 60 or 120 minutes.');
  }
  if (patch.allowedNetworks) {
    const bad = patch.allowedNetworks.find((network) => !parseCidr(network.cidr));
    if (bad) throw errors.validation({ allowedNetworks: bad.cidr }, `${bad.cidr} isn’t an IP address or range.`);
    // Saving a list that leaves out the network you're on would lock you out on the next request.
    if (!networkAllows(patch.allowedNetworks, ip)) {
      throw errors.validation({ allowedNetworks: 'excludes current' }, 'Add the network you’re on now first, or you’d be signed out of the portal.');
    }
  }
  await db.withSystem(`admin ${staff.identity.userId}: change the admin access policy`, async (tx) => {
    const before = await tx.selectFrom('admin_settings').selectAll().executeTakeFirstOrThrow();
    const set = {
      ...(patch.sessionTimeoutMinutes !== undefined ? { session_timeout_minutes: patch.sessionTimeoutMinutes } : {}),
      ...(patch.reauthForSensitive !== undefined ? { reauth_for_sensitive: patch.reauthForSensitive } : {}),
      ...(patch.allowedNetworks ? { allowed_networks: JSON.stringify(patch.allowedNetworks.map(({ cidr, label }) => ({ cidr: cidr.trim(), label: label.trim().slice(0, 60) }))) } : {}),
    };
    await tx.updateTable('admin_settings').set({ ...set, updated_by: staff.identity.userId, updated_at: sql`now()` }).execute();
    await writeAudit(
      tx,
      staff,
      {
        action: 'settings.update',
        targetType: 'settings',
        targetId: 'admin',
        before: { sessionTimeoutMinutes: before.session_timeout_minutes, reauthForSensitive: before.reauth_for_sensitive, allowedNetworks: before.allowed_networks },
        after: patch,
      },
      meta,
    );
  });
}

export async function regenerateBackupCodes(db: Database, auth: StaffAuth, staff: Staff, accountId: string, meta: RequestMeta) {
  return db.withSystem(`admin ${staff.identity.userId}: regenerate own backup codes`, async (tx) => {
    const codes = await auth.regenerateBackupCodes(tx, accountId);
    await writeAudit(tx, staff, { action: 'staff.backup_codes', targetType: 'user', targetId: staff.identity.userId }, meta);
    return codes;
  });
}

export async function auditAuthenticatorReplaced(db: Database, staff: Staff, meta: RequestMeta) {
  await db.withSystem(`admin ${staff.identity.userId}: record a replaced authenticator`, (tx) =>
    writeAudit(tx, staff, { action: 'staff.authenticator', targetType: 'user', targetId: staff.identity.userId }, meta),
  );
}
