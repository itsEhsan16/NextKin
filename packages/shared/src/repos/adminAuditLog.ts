import { adminMeFixture } from '../mock/fixtures/admin';
import { adminAuditFixture } from '../mock/fixtures/adminTrust';
import type { AuditEvent, AuditTargetType } from '../models/adminTrust';

import { onAdminMockReset } from './adminMockReset';

/**
 * The mock audit log's session rows (`toreview.md` §171.8). The server audits every staff action
 * itself; on the mock, each admin repository calls `recordAdminAudit` where it changes something,
 * so what staff do in this session shows at the top of the Audit log, newest first, ahead of the
 * fixture's history. The actor is the signed-in mock staff member (Ehsan), from their own address.
 * The session's rows go when the mocks reset.
 */
let recorded: AuditEvent[] = [];
let sequence = 0;
onAdminMockReset(() => {
  recorded = [];
});

/** The signed-in staff member as the fixture's history names them, so the Staff filter finds both. */
const actor = () => {
  const row = adminAuditFixture.find((event) => event.staff.name === adminMeFixture.name);
  return {
    staff: row?.staff ?? {
      id: adminMeFixture.userId,
      name: adminMeFixture.name,
      role: adminMeFixture.role,
    },
    ip: row?.ip ?? '',
  };
};

/** "user ···4f2a": a person or their content is named by the last four characters of its id. */
export const auditRef = (prefix: string, id: string) => `${prefix} ···${id.slice(-4)}`;

/**
 * Appends one row: the action as the log words it ("Suspended an account"), the target already
 * masked where it names a person or their content, and the reason given ("—" when none was asked).
 */
export function recordAdminAudit(
  action: string,
  type: AuditTargetType,
  label: string,
  reason?: string,
): void {
  sequence += 1;
  const { staff, ip } = actor();
  recorded = [
    {
      id: `aud_session_${sequence}`,
      at: new Date().toISOString(),
      staff,
      action,
      contentRead: action === 'Opened resume content',
      target: { type, label },
      reason: reason?.trim() || '—',
      ip,
    },
    ...recorded,
  ];
}

/** This session's rows, newest first. */
export const recordedAdminAudit = (): readonly AuditEvent[] => recorded;
