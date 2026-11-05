import { z } from 'zod';

import type { AdminRole } from '../../models/admin';
import type { AuditEvent, AuditFilters, AuditTargetType } from '../../models/adminTrust';
import { tailOf } from '../adminTrustRepo';

/**
 * The audit log over the API (`packages/server/src/services/admin/audit.ts`), for
 * `adminTrustRepo.ts`: the rows `GET /admin/audit` answers, the filters it can apply, and how a
 * row reads on the board (Figma 408:1759): an action in words, a masked target.
 */

/** `GET /admin/audit` rows (`audit.searchAudit`), newest first. */
export const auditRows = z.object({
  data: z.array(
    z
      .object({
        id: z.union([z.number(), z.string()]),
        actorUserId: z.string().nullable(),
        actorRole: z.string().nullable(),
        action: z.string(),
        targetType: z.string().nullable(),
        targetId: z.string().nullable(),
        before: z.unknown().optional(),
        after: z.unknown().optional(),
        reason: z.string().nullable(),
        ip: z.string().nullable().optional(),
        createdAt: z.string(),
      })
      .passthrough(),
  ),
});

type AuditRow = z.infer<typeof auditRows>['data'][number];

/** The most rows one request returns (`audit.searchAudit` caps `limit` at 500). */
export const AUDIT_LIMIT = 500;

const ROLES = new Set<string>(['support', 'curator', 'admin', 'super_admin']);

/** What each server action code reads as (every `writeAudit` call under `services/admin`). */
const ACTION_LABEL: Record<string, string> = {
  'user.password_reset': 'Sent a password reset',
  'user.suspend': 'Suspended an account',
  'user.reactivate': 'Reactivated an account',
  'user.delete': 'Processed deletion',
  'user.comp': 'Granted comp',
  'user.content_read': 'Opened resume content',
  'staff.roles': 'Changed role',
  'prompt.draft': 'Drafted prompt',
  'prompt.stage': 'Staged prompt',
  'prompt.evaluate': 'Evaluated prompt',
  'prompt.publish': 'Published prompt',
  'prompt.rollback': 'Rolled back prompt',
  'kb.create': 'Added KB entry',
  'kb.update': 'Edited KB entry',
  'kb.reject': 'Rejected KB change',
  'kb.import': 'Imported KB entry',
  'kb.dataset_publish': 'Published KB dataset',
  'template.publish': 'Published template',
  'template.unpublish': 'Unpublished template',
  'template.archive': 'Archived template',
  'plan.prices': 'Changed plan prices',
  'plan.quotas': 'Changed plan quotas',
  'provider.update': 'Changed provider settings',
  'provider.key': 'Set provider key',
  'generation.retry': 'Retried a run',
  'generation.resolve': 'Resolved a run',
  'abuse_report.dismiss': 'Dismissed report',
  'abuse_report.disable_link': 'Disabled reported link',
  'abuse_report.suspend_owner': 'Suspended reported owner',
};

/** A label back to the code the API filters on; the refined labels share their code's. */
const ACTION_CODE: Record<string, string> = {
  ...Object.fromEntries(Object.entries(ACTION_LABEL).map(([code, label]) => [label, code])),
  'Approved KB change': 'kb.update',
  'Published KB entry': 'kb.update',
  'Turned provider on': 'provider.update',
  'Paused provider': 'provider.update',
};

/**
 * The API's target type for each of the model's. A role change is audited against the staff
 * member's user row, so Staff asks for `user` rows and keeps the role changes.
 */
const SERVER_TARGET: Record<AuditTargetType, string> = {
  user: 'user',
  staff: 'user',
  resume: 'resume',
  prompt: 'prompt',
  technology: 'technology',
  provider: 'job_provider',
  export: 'export',
};

/** How far back each range reaches, for the API's `from`. */
const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 } as const;

/** Actor ids are user ids; anything else (the "System" row) can only be filtered here. */
const USER_ID = /^[0-9a-f-]{36}$/i;

export const asRecord = (value: unknown) =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/** The filters the API can apply. Free text and a "System" actor are applied to the rows. */
export function serverQuery(filters: AuditFilters) {
  const action = filters.action === 'all' ? null : (ACTION_CODE[filters.action] ?? filters.action);
  return {
    ...(filters.range !== 'all'
      ? { from: new Date(Date.now() - RANGE_DAYS[filters.range] * 86_400_000).toISOString() }
      : {}),
    ...(action ? { action } : filters.targetType === 'staff' ? { action: 'staff.roles' } : {}),
    ...(filters.targetType !== 'all' ? { targetType: SERVER_TARGET[filters.targetType] } : {}),
    ...(USER_ID.test(filters.staff) ? { actor: filters.staff } : {}),
  };
}

/** A KB edit that moved the review status, or a provider switched on or off, says so. */
function actionOf(row: AuditRow): string {
  const before = asRecord(row.before);
  const after = asRecord(row.after);
  if (
    row.action === 'kb.update' &&
    before &&
    after &&
    before.review_status !== after.review_status
  ) {
    if (after.review_status === 'admin_reviewed') return 'Approved KB change';
    if (after.review_status === 'published') return 'Published KB entry';
  }
  if (row.action === 'provider.update' && before && after && before.enabled !== after.enabled) {
    return after.enabled === true ? 'Turned provider on' : 'Paused provider';
  }
  return ACTION_LABEL[row.action] ?? row.action;
}

/**
 * The target cell, masked where it names a person or their content ("user ···4f2a"); a plan,
 * provider, template or prompt version is named in full. The model has no plan, template or KB
 * dataset type: a template counts as a prompt (as on the mock), a dataset as the KB, and a plan
 * falls back to `user`. They only show unfiltered, since the API filters target types exactly.
 */
function targetOf(row: AuditRow): AuditEvent['target'] {
  const id = row.targetId;
  if (!id) return { type: 'user', label: '—' };
  const masked = (type: AuditTargetType, prefix: string = type) => ({
    type,
    label: `${prefix} ···${tailOf(id)}`,
  });
  const after = asRecord(row.after);
  switch (row.targetType) {
    case 'user':
      return row.action === 'staff.roles' ? masked('staff') : masked('user');
    case 'resume':
      return masked('resume');
    case 'technology':
      return masked('technology', 'tech');
    case 'kb_dataset':
      return { type: 'technology', label: `KB dataset v${id}` };
    case 'prompt':
      return typeof after?.name === 'string' && typeof after.version === 'number'
        ? { type: 'prompt', label: `${after.name} v${after.version}` }
        : masked('prompt');
    case 'template':
      return { type: 'prompt', label: `template ${id}` };
    case 'job_provider':
      return { type: 'provider', label: `provider ${id}` };
    case 'plan':
      return { type: 'user', label: `plan ${id}` };
    case 'generation':
      return masked('user', 'run');
    case 'abuse_report':
      return { type: 'resume', label: `report ${id}` };
    default:
      return masked('user', row.targetType ?? 'target');
  }
}

/**
 * The audit row names the actor by id; `names` (`/admin/staff/names`, toreview §171.13) turns it
 * into the staff member's name. An id the list doesn't know (a removed account) stays masked.
 */
export function toEvent(row: AuditRow, names: Record<string, string> = {}): AuditEvent {
  return {
    id: String(row.id),
    at: row.createdAt,
    staff: {
      id: row.actorUserId ?? 'system',
      name: row.actorUserId
        ? (names[row.actorUserId] ?? `staff ···${tailOf(row.actorUserId)}`)
        : 'System',
      role: (ROLES.has(row.actorRole ?? '') ? row.actorRole : 'support') as AdminRole,
    },
    action: actionOf(row),
    contentRead: row.action === 'user.content_read',
    target: targetOf(row),
    reason: row.reason || '—',
    ip: row.ip ?? '',
  };
}
