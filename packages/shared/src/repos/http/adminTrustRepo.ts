import type { AuditFilters } from '../../models/adminTrust';
import { matchesAudit, AUDIT_PAGE_SIZE, type AdminTrustRepo } from '../adminTrustRepo';
import { AUDIT_LIMIT, auditRows, serverQuery, toEvent } from './adminTrustAudit';
import { createStaffAuthOps } from './adminStaffAuth';
import { fetchStaffNames } from './adminStaffOps';
import { createTrustOps } from './adminTrustOps';
import type { HttpClient } from './client';

/**
 * `AdminTrustRepo` over `/api/v1/admin/*` and `/api/v1/auth/admin/login`. Every method answers from
 * the server: the audit log, staff sign-in, the failure queue and abuse reports are served
 * (`adminTrustOps.ts` maps the last two). No fixture reaches a real staff session (`toreview.md`
 * §171.8, §171.13). How an audit row maps onto the model is in `adminTrustAudit.ts`.
 */
export function createHttpAdminTrustRepo(http: HttpClient): AdminTrustRepo {
  // The filter menus list everyone and every action seen so far, so narrowing to one staff member
  // doesn't empty the menu of the others.
  const seenStaff = new Map<string, string>();
  const seenActions = new Set<string>();

  const auditEvents = async (filters: AuditFilters) => {
    const [{ data }, names] = await Promise.all([
      http
        .request('/admin/audit', { query: { ...serverQuery(filters), limit: AUDIT_LIMIT } })
        .then((raw) => auditRows.parse(raw)),
      // Names make the log readable; without them the rows still show masked ids.
      fetchStaffNames(http).catch(() => ({})),
    ]);
    const events = data.map((row) => toEvent(row, names));
    for (const event of events) {
      seenStaff.set(event.staff.id, event.staff.name);
      seenActions.add(event.action);
    }
    return {
      // The search box filters what came back; the API has no free-text filter.
      rows: events.filter((event) => matchesAudit(event, { ...filters, range: 'all' })),
      // A full page of 500 means older rows may match too: the count isn't known.
      capped: data.length >= AUDIT_LIMIT,
    };
  };

  const trustOps = createTrustOps(http);

  return {
    // Generation failures and abuse reports (`adminTrustOps.ts`).
    ...trustOps,

    audit: async (filters, page) => {
      const { rows, capped } = await auditEvents(filters);
      const pages = Math.max(1, Math.ceil(rows.length / AUDIT_PAGE_SIZE));
      const at = Math.min(Math.max(1, page), pages);
      return {
        rows: rows.slice((at - 1) * AUDIT_PAGE_SIZE, at * AUDIT_PAGE_SIZE),
        total: capped ? null : rows.length,
        // With no total, the page says how many rows it loaded ("500+ shown"), not how many are on
        // this page.
        ...(capped ? { loaded: rows.length } : {}),
        pages,
        staffOptions: [...seenStaff].map(([id, name]) => ({ id, name })),
        actionOptions: [...seenActions].sort(),
      };
    },
    // An attachment, not JSON: the browser downloads it with the session cookie. The API applies
    // the menus' filters; it has no free-text search.
    exportAudit: async (filters) => ({
      kind: 'url',
      url: http.url('/admin/audit/export', serverQuery(filters)),
    }),

    // Staff sign-in and Settings (toreview §171.13).
    ...createStaffAuthOps(http),
  };
}
