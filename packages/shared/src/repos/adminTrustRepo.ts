import {
  adminAuditFixture,
  adminFailureStatsFixture,
  adminFailuresFixture,
  adminReportStatsFixture,
  adminReportsFixture,
  adminSettingsFixture,
  failureDetailFixture,
} from '../mock/fixtures/adminTrust';
import { simulate } from '../mock';
import type {
  AbuseReport,
  AbuseReportDetail,
  AdminSettings,
  AdminSettingsPatch,
  AdminSignInResult,
  AuthenticatorSetup,
  AuditEvent,
  AuditFilters,
  AuditPage,
  FailureDetail,
  FailureFilter,
  FailurePage,
  FailureQuery,
  FailureStats,
  GenerationFailure,
  ReportAction,
  ReportCategory,
  ReportFilter,
  ReportPage,
  ReportStats,
} from '../models/adminTrust';
import { ADMIN_ROLE_LABEL } from '../models/admin';
import { FAILURE_KIND_LABEL, REPORT_CATEGORY_LABEL } from '../models/adminTrust';

import { recordAdminAudit, recordedAdminAudit } from './adminAuditLog';
import { onAdminMockReset } from './adminMockReset';
import { clone, NotFoundError } from './state';

/** Rows per page, as the boards draw them: 9 failed runs, 8 reports, 12 audit events. */
export const FAILURES_PAGE_SIZE = 9;
export const REPORTS_PAGE_SIZE = 8;
export const AUDIT_PAGE_SIZE = 12;

/**
 * The admin portal's Trust & safety area (Figma 406:1195, 407:946, 408:1531, 409:1500, 410:1605).
 *
 * A method answers `null` where its source doesn't serve the data yet (the HTTP repository, for the
 * failure queue, reports and settings), and the screen says "Not connected yet" rather than drawing
 * fixture data there. Actions are audited on the server; the mock records them in its session log
 * (`adminAuditLog.ts`).
 */
export interface AdminTrustRepo {
  failureStats(): Promise<FailureStats | null>;
  failures(query: FailureQuery): Promise<FailurePage | null>;
  failureDetail(id: string): Promise<FailureDetail | null>;
  /** Queues a manual retry for each run: they move to Retrying. */
  retryFailures(ids: string[]): Promise<void>;
  /** Closes a run without retrying it. */
  resolveFailure(id: string): Promise<void>;
  /** Every run matching the query (all pages), as CSV. */
  exportFailures(query: FailureQuery): Promise<string>;

  reportStats(): Promise<ReportStats | null>;
  reports(
    filter: ReportFilter,
    search: string,
    page: number,
    categories?: ReportCategory[],
  ): Promise<ReportPage | null>;
  report(id: string): Promise<AbuseReportDetail | null>;
  /** Settles a report with a reason code and a note. The reporter is never told who acted. */
  actOnReport(
    id: string,
    input: { action: ReportAction; reason: string; note: string },
  ): Promise<AbuseReportDetail>;
  exportReports(
    filter: ReportFilter,
    search: string,
    categories?: ReportCategory[],
  ): Promise<string>;

  audit(filters: AuditFilters, page: number): Promise<AuditPage>;
  /**
   * The filtered log as CSV: the file's text (the mock), or the server's `/admin/audit/export`
   * address for the browser to download with the session cookie.
   */
  exportAudit(filters: AuditFilters): Promise<AuditExport>;

  settings(): Promise<AdminSettings | null>;
  updateSettings(patch: AdminSettingsPatch): Promise<AdminSettings>;
  /** Replaces every backup code; the new ones are shown once. */
  regenerateBackupCodes(): Promise<string[]>;
  /** Starts replacing the signed-in member's authenticator: a new one to scan. */
  beginAuthenticatorReplacement(): Promise<AuthenticatorSetup>;
  /** Finishes it with one code from the new authenticator; answers with new backup codes. */
  confirmAuthenticatorReplacement(input: { challenge: string; code: string }): Promise<string[]>;
  /** Proves the authenticator again before a sensitive action (Settings › Re-authenticate). */
  reauthenticate(code: string): Promise<void>;

  /** Staff sign-in: password first, then the authenticator's code. */
  signIn(input: { email: string; password: string; totp?: string }): Promise<AdminSignInResult>;
  /** First sign-in: confirms the new authenticator with one code. */
  confirmEnrollment(input: { challenge: string; code: string }): Promise<AdminSignInResult>;
  /** First sign-in or after a reset: replaces the temporary password, then signs in. */
  setNewPassword(input: { challenge: string; password: string }): Promise<AdminSignInResult>;
}

export type AuditExport = { kind: 'csv'; csv: string } | { kind: 'url'; url: string };

const csvCell = (value: string | number) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const toCsv = (rows: (string | number)[][]): string =>
  rows.map((row) => row.map(csvCell).join(',')).join('\n');

/** "user ···4f2a" from an id: its last four characters. */
export const tailOf = (id: string) => id.slice(-4);

const pageOf = <T>(rows: T[], page: number, size: number) => {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const at = Math.min(Math.max(1, page), pages);
  return { rows: rows.slice((at - 1) * size, at * size), pages };
};

// --- Filters (shared with the tests) ---------------------------------------------------------

export function matchesFailure(row: GenerationFailure, query: FailureQuery): boolean {
  if (query.kinds.length > 0 && !query.kinds.includes(row.kind)) return false;
  const needle = query.search.trim().toLowerCase();
  if (!needle) return true;
  return [row.id, row.userRef, row.errorCode, row.stage, FAILURE_KIND_LABEL[row.kind]]
    .join(' ')
    .toLowerCase()
    .includes(needle);
}

export function matchesReport(
  row: AbuseReport,
  search: string,
  categories: ReportCategory[] = [],
): boolean {
  if (categories.length > 0 && !categories.includes(row.category)) return false;
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [row.id, row.item.ref, REPORT_CATEGORY_LABEL[row.category]]
    .join(' ')
    .toLowerCase()
    .includes(needle);
}

const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 } as const;

export function matchesAudit(row: AuditEvent, filters: AuditFilters, now = Date.now()): boolean {
  if (filters.range !== 'all') {
    if (new Date(row.at).getTime() < now - RANGE_DAYS[filters.range] * 86_400_000) return false;
  }
  if (filters.staff !== 'all' && row.staff.id !== filters.staff) return false;
  if (filters.action !== 'all' && row.action !== filters.action) return false;
  if (filters.targetType !== 'all' && row.target.type !== filters.targetType) return false;
  const needle = filters.search.trim().toLowerCase();
  if (!needle) return true;
  // The masked address, as the table shows it: searching can't probe the hidden part.
  return [row.target.label, row.reason, maskIp(row.ip), row.action, row.staff.name]
    .join(' ')
    .toLowerCase()
    .includes(needle);
}

export function auditCsv(rows: AuditEvent[]): string {
  return toCsv([
    ['time_utc', 'staff', 'role', 'action', 'target_type', 'target', 'reason', 'ip'],
    ...rows.map((row) => [
      row.at,
      row.staff.name,
      ADMIN_ROLE_LABEL[row.staff.role],
      row.action,
      row.target.type,
      row.target.label,
      row.reason,
      maskIp(row.ip),
    ]),
  ]);
}

/** "102.89.···.14": the network and the host's last part, never the whole address. */
export function maskIp(ip: string): string {
  const parts = ip.split('.');
  if (parts.length !== 4) return ip ? '···' : '—';
  return `${parts[0]}.${parts[1]}.···.${parts[3]}`;
}

/** The server's floor for a staff password (`auth/staff/service.ts`). */
export const STAFF_PASSWORD_MIN = 12;

/** The mock's authenticator set-up: a fixed, published secret (it signs nothing in). */
const MOCK_TOTP_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const mockSetup = (account: string): AuthenticatorSetup => ({
  challenge: 'mock-enrol-step',
  secret: MOCK_TOTP_SECRET,
  otpauthUrl: `otpauth://totp/NextKin:${encodeURIComponent(account)}?secret=${MOCK_TOTP_SECRET}&issuer=NextKin&algorithm=SHA1&digits=6&period=30`,
});
const mockBackupCodes = () =>
  Array.from({ length: 10 }, () =>
    Array.from({ length: 2 }, () => Math.random().toString(16).slice(2, 6).padEnd(4, '0')).join('-'),
  );

/** A backup code as Settings issues them: "4f2a-9c10". */
export const BACKUP_CODE = /^[a-z0-9]{4}-?[a-z0-9]{4}$/i;

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

/** An IPv4 address, or a CIDR range of one ("203.0.113.0/24"). */
export function isNetwork(value: string): boolean {
  const [address = '', bits, ...rest] = value.trim().split('/');
  if (rest.length > 0 || !IPV4.test(address)) return false;
  if (bits === undefined) return true;
  return /^\d{1,2}$/.test(bits) && Number(bits) <= 32;
}

const toInt = (address: string) =>
  address.split('.').reduce((sum, part) => sum * 256 + Number(part), 0);

/** Whether an address falls inside an allowed entry. */
export function networkCovers(entry: string, ip: string): boolean {
  const [address = '', bits = '32'] = entry.split('/');
  if (!IPV4.test(address) || !IPV4.test(ip)) return false;
  const width = Number(bits);
  if (width === 0) return true;
  const mask = width === 32 ? 0xffffffff : (~((1 << (32 - width)) - 1) >>> 0) >>> 0;
  return (toInt(address) & mask) >>> 0 === (toInt(ip) & mask) >>> 0;
}

// --- The mock --------------------------------------------------------------------------------

export function createMockAdminTrustRepo(): AdminTrustRepo {
  let failures = clone(adminFailuresFixture);
  let reports = clone(adminReportsFixture);
  let settings = adminSettingsFixture();
  onAdminMockReset(() => {
    failures = clone(adminFailuresFixture);
    reports = clone(adminReportsFixture);
    settings = adminSettingsFixture();
  });

  const failureCounts = (query: FailureQuery): Record<FailureFilter, number> => {
    const matching = failures.filter((row) => matchesFailure(row, query));
    return {
      open: matching.filter((row) => row.status === 'open').length,
      retrying: matching.filter((row) => row.status === 'retrying').length,
      resolved: matching.filter((row) => row.status === 'resolved').length,
      all: matching.length,
    };
  };
  const filteredFailures = (query: FailureQuery) =>
    failures.filter(
      (row) =>
        matchesFailure(row, query) && (query.status === 'all' || row.status === query.status),
    );
  const findFailure = (id: string) => {
    const row = failures.find((f) => f.id === id);
    if (!row) throw new NotFoundError('GenerationFailure', id);
    return row;
  };

  const reportCounts = (
    search: string,
    categories: ReportCategory[] = [],
  ): Record<ReportFilter, number> => {
    const matching = reports.filter((row) => matchesReport(row, search, categories));
    return {
      open: matching.filter((row) => row.status === 'open').length,
      resolved: matching.filter((row) => row.status !== 'open').length,
      all: matching.length,
    };
  };
  const filteredReports = (
    filter: ReportFilter,
    search: string,
    categories: ReportCategory[] = [],
  ) =>
    reports.filter(
      (row) =>
        matchesReport(row, search, categories) &&
        (filter === 'all' || (filter === 'open' ? row.status === 'open' : row.status !== 'open')),
    );
  const summary = ({
    id,
    category,
    item,
    receivedAt,
    status,
    reporter,
  }: AbuseReportDetail): AbuseReport => ({
    id,
    category,
    item,
    receivedAt,
    status,
    reporter,
  });

  return {
    failureStats: () =>
      simulate(
        () => {
          const open = failures.filter((row) => row.status === 'open').length;
          // The board's "oldest 2 h ago" only while something is open.
          return {
            ...adminFailureStatsFixture,
            open,
            openNote: open > 0 ? adminFailureStatsFixture.openNote : 'nothing waiting',
          };
        },
        { empty: () => EMPTY_FAILURE_STATS },
      ),
    failures: (query) =>
      simulate<FailurePage | null>(
        () => {
          const rows = filteredFailures(query);
          const { rows: page, pages } = pageOf(rows, query.page, FAILURES_PAGE_SIZE);
          return { rows: clone(page), total: rows.length, pages, counts: failureCounts(query) };
        },
        {
          empty: () => ({
            rows: [],
            total: 0,
            pages: 1,
            counts: { open: 0, retrying: 0, resolved: 0, all: 0 },
          }),
        },
      ),
    failureDetail: (id) => simulate(() => failureDetailFixture(clone(findFailure(id)))),
    retryFailures: (ids) =>
      simulate(() => {
        // Only an open run is retried: a retrying one already is, a resolved one is closed.
        for (const row of ids.map(findFailure).filter((row) => row.status === 'open')) {
          row.status = 'retrying';
          recordAdminAudit('Retried a run', 'user', `run ···${tailOf(row.id)}`, 'Manual retry');
        }
      }),
    resolveFailure: (id) =>
      simulate(() => {
        findFailure(id).status = 'resolved';
        recordAdminAudit('Resolved a run', 'user', `run ···${tailOf(id)}`);
      }),
    exportFailures: (query) =>
      simulate(() =>
        toCsv([
          ['run', 'kind', 'stage', 'error_code', 'user', 'attempts', 'failed_at', 'status'],
          ...filteredFailures(query).map((row) => [
            `run ···${tailOf(row.id)}`,
            FAILURE_KIND_LABEL[row.kind],
            row.stage,
            row.errorCode,
            `user ···${tailOf(row.userRef)}`,
            `${row.attempts} of ${row.maxAttempts}`,
            row.failedAt,
            row.status,
          ]),
        ]),
      ),

    reportStats: () => simulate(() => reportStatsOf(reports), { empty: () => reportStatsOf([]) }),
    reports: (filter, search, page, categories = []) =>
      simulate<ReportPage | null>(
        () => {
          const rows = filteredReports(filter, search, categories);
          const { rows: slice, pages } = pageOf(rows, page, REPORTS_PAGE_SIZE);
          return {
            rows: slice.map(summary),
            total: rows.length,
            pages,
            counts: reportCounts(search, categories),
          };
        },
        {
          empty: () => ({ rows: [], total: 0, pages: 1, counts: { open: 0, resolved: 0, all: 0 } }),
        },
      ),
    report: (id) =>
      simulate(() => {
        const row = reports.find((r) => r.id === id);
        if (!row) throw new NotFoundError('AbuseReport', id);
        return clone(row);
      }),
    actOnReport: (id, input) =>
      simulate(() => {
        const row = reports.find((r) => r.id === id);
        if (!row) throw new NotFoundError('AbuseReport', id);
        row.status = input.action === 'dismiss' ? 'dismissed' : 'resolved';
        row.outcome = { ...input, at: new Date().toISOString() };
        recordAdminAudit(
          `${input.action === 'dismiss' ? 'Dismissed' : 'Resolved'} report`,
          'resume',
          `report ${row.id}`,
          input.reason,
        );
        return clone(row);
      }),
    exportReports: (filter, search, categories = []) =>
      simulate(() =>
        toCsv([
          ['report', 'category', 'item', 'item_kind', 'reporter', 'received', 'status'],
          ...filteredReports(filter, search, categories).map((row) => [
            row.id,
            REPORT_CATEGORY_LABEL[row.category],
            `${row.item.kind === 'public_link' ? 'link' : 'resume'} ···${tailOf(row.item.ref)}`,
            row.item.kind === 'public_link' ? 'Public link' : 'Shared resume',
            'Anonymous',
            row.receivedAt,
            row.status,
          ]),
        ]),
      ),

    audit: (filters, page) =>
      simulate<AuditPage>(
        () => {
          const rows = auditRows().filter((row) => matchesAudit(row, filters));
          const { rows: slice, pages } = pageOf(rows, page, AUDIT_PAGE_SIZE);
          return {
            rows: clone(slice),
            total: rows.length,
            pages,
            staffOptions: STAFF_OPTIONS,
            actionOptions: actionOptions(),
          };
        },
        {
          empty: () => ({
            rows: [],
            total: 0,
            pages: 1,
            staffOptions: STAFF_OPTIONS,
            actionOptions: actionOptions(),
          }),
        },
      ),
    exportAudit: (filters) =>
      simulate<AuditExport>(() => ({
        kind: 'csv',
        csv: auditCsv(auditRows().filter((row) => matchesAudit(row, filters))),
      })),

    settings: () =>
      simulate(() => clone(settings), {
        empty: () => ({
          ...clone(settings),
          allowedNetworks: [],
          backupCodes: { unused: 0, total: 10 },
        }),
      }),
    updateSettings: (patch) =>
      simulate(() => {
        if (patch.allowedNetworks?.some((entry) => !isNetwork(entry.cidr))) {
          throw new Error('Enter an IPv4 address or a CIDR range, like 203.0.113.0/24.');
        }
        settings = { ...settings, ...clone(patch) };
        for (const key of Object.keys(patch) as (keyof AdminSettingsPatch)[])
          recordAdminAudit(SETTING_ACTION[key], 'staff', 'admin settings');
        return clone(settings);
      }),
    regenerateBackupCodes: () =>
      simulate(() => {
        settings = { ...settings, backupCodes: { unused: 10, total: 10 } };
        recordAdminAudit('Regenerated backup codes', 'staff', 'own account');
        return mockBackupCodes();
      }),
    beginAuthenticatorReplacement: () => simulate<AuthenticatorSetup>(() => mockSetup('ehsan@nextkin.ai')),
    confirmAuthenticatorReplacement: ({ code }) =>
      simulate(() => {
        if (!/^\d{6}$/.test(code.trim())) throw new Error('That code didn’t work. Check your app and try again.');
        const now = new Date().toISOString();
        settings = { ...settings, authenticator: { addedAt: now, lastUsedAt: now }, backupCodes: { unused: 10, total: 10 } };
        recordAdminAudit('Replaced authenticator', 'staff', 'own account');
        return mockBackupCodes();
      }),
    reauthenticate: (code) =>
      simulate(() => {
        if (!/^\d{6}$/.test(code.trim()) && !BACKUP_CODE.test(code.trim())) {
          throw new Error('That code didn’t work. Check your app and try again.');
        }
      }),

    signIn: (input) =>
      simulate<AdminSignInResult>(() => {
        if (!input.email.trim() || !input.password)
          throw new Error('Enter your email and password.');
        // The mock's new accounts: an email starting "new" walks the first sign-in (set up the
        // authenticator, then a new password), as an invited member's does on the server.
        if (/^new/i.test(input.email.trim())) {
          return { status: 'enroll_totp', ...mockSetup(input.email.trim()) };
        }
        if (!input.totp) return { status: 'mfa_required' };
        // A backup code works once: it spends one of the codes Settings counts.
        if (BACKUP_CODE.test(input.totp)) {
          if (settings.backupCodes.unused === 0) throw new Error('No backup codes are left.');
          const { unused, total } = settings.backupCodes;
          settings = { ...settings, backupCodes: { unused: unused - 1, total } };
          return { status: 'signed_in' };
        }
        if (!/^\d{6}$/.test(input.totp)) throw new Error('Enter the 6-digit code from your app.');
        return { status: 'signed_in' };
      }),
    confirmEnrollment: ({ code }) =>
      simulate<AdminSignInResult>(() => {
        if (!/^\d{6}$/.test(code.trim())) throw new Error('That code didn’t work. Check your app and try again.');
        return { status: 'change_password', challenge: 'mock-password-step', backupCodes: mockBackupCodes() };
      }),
    setNewPassword: ({ password }) =>
      simulate<AdminSignInResult>(() => {
        if (password.length < STAFF_PASSWORD_MIN) {
          throw new Error(`Use at least ${STAFF_PASSWORD_MIN} characters.`);
        }
        return { status: 'signed_in' };
      }),
  };
}

/** Generation failures with nothing in the window (the mock's empty mode). */
const EMPTY_FAILURE_STATS: FailureStats = {
  failed30d: 0,
  failedRate: 0,
  totalRuns: 0,
  open: 0,
  openNote: 'nothing waiting',
  retriedOk: 0,
  retriedOkRate: 0,
  mostCommon: null,
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * The report cards, counted from the reports themselves so a decision moves them: open now, and
 * what was settled in the last 30 days and how ("9 dismissed · 4 links disabled · 1 suspension").
 * The median time to resolve stays the board's figure.
 */
function reportStatsOf(reports: AbuseReportDetail[], now = Date.now()): ReportStats {
  const open = reports.filter((row) => row.status === 'open').length;
  const settled = reports.filter(
    (row) => row.outcome && now - new Date(row.outcome.at).getTime() <= 30 * 86_400_000,
  );
  const by = (action: ReportAction) =>
    settled.filter((row) => row.outcome?.action === action).length;
  return {
    ...adminReportStatsFixture,
    open,
    openNote: open > 0 ? adminReportStatsFixture.openNote : 'nothing waiting',
    resolved30d: settled.length,
    medianResolveHours: settled.length > 0 ? adminReportStatsFixture.medianResolveHours : null,
    resolvedNote:
      settled.length > 0
        ? [
            `${by('dismiss')} dismissed`,
            plural(by('disable_link'), 'link disabled', 'links disabled'),
            plural(by('suspend_owner'), 'suspension', 'suspensions'),
          ].join(' · ')
        : 'none in the last 30 days',
  };
}

const STAFF_OPTIONS = Array.from(
  new Map(adminAuditFixture.map((row) => [row.staff.id, row.staff.name])).entries(),
).map(([id, name]) => ({ id, name }));

/** How the log words a settings change. */
const SETTING_ACTION: Record<keyof AdminSettingsPatch, string> = {
  sessionTimeoutMinutes: 'Changed session timeout',
  reauthForSensitive: 'Changed re-auth rule',
  allowedNetworks: 'Changed allowed networks',
};

/** This session's rows (what staff did on the mock), then the fixture's history. */
const auditRows = (): AuditEvent[] => [...recordedAdminAudit(), ...adminAuditFixture];

const actionOptions = () => Array.from(new Set(auditRows().map((row) => row.action))).sort();
