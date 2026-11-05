/**
 * The admin portal's Trust & safety area: generation failures (Figma 406:1195, run drawer
 * 406:1691), abuse reports (407:946), the audit log (408:1531), admin settings (409:1500) and
 * staff sign-in (410:1605).
 *
 * Users, runs, links and resumes are referred to by a reference whose last four characters the
 * screens show ("user ···4f2a"); nothing here carries a user's name, email or resume content.
 */

import type { AdminRole } from './admin';

// --- Generation failures ---------------------------------------------------------------------

export type FailureStatus = 'open' | 'retrying' | 'resolved';
export type FailureFilter = FailureStatus | 'all';

export type FailureKind = 'tailor' | 'resume_build' | 'cover_letter' | 'ats_check' | 'interview';

export const FAILURE_KIND_LABEL: Record<FailureKind, string> = {
  tailor: 'Tailor',
  resume_build: 'Resume build',
  cover_letter: 'Cover letter',
  ats_check: 'ATS check',
  interview: 'Interview',
};

/** One stage of the run, as the drawer's timeline draws it (Figma 406:1704). */
export type FailureStage = {
  name: string;
  outcome: 'done' | 'failed' | 'skipped';
  detail: string;
  /** How long a finished stage took; absent for a failed or skipped one. */
  seconds?: number;
  /** The failed stage's short label: "Timed out". */
  label?: string;
};

/** A run that failed after every automatic retry. */
export type GenerationFailure = {
  /** The run's id; the screen shows its last four characters. */
  id: string;
  kind: FailureKind;
  /** The stage it failed at: "tailor.rewrite". */
  stage: string;
  errorCode: string;
  userRef: string;
  attempts: number;
  maxAttempts: number;
  failedAt: string;
  status: FailureStatus;
};

/** What the run drawer adds to a row (Figma 406:1691). Never the resume's content. */
export type FailureDetail = GenerationFailure & {
  stages: FailureStage[];
  /** `requestRef` is `null` when the run made no model call. */
  error: { message: string; requestRef: string | null; retryPolicy: string };
  /**
   * The prompt version the run was pinned to; `null` when it was never claimed. `publishedAt` is
   * `null` when no publish of that version is on record (a seeded prompt).
   */
  prompt: { name: string; version: number; publishedAt: string | null } | null;
  /** The model of the run's last call; `null` when it made none. */
  model: string | null;
  tokensIn: number;
  tokensOut: number;
  startedAt: string;
  /** `null` while a retry is still running. */
  endedAt: string | null;
};

export type FailureStats = {
  failed30d: number;
  /** Failed runs as a share of all runs in the window. */
  failedRate: number;
  totalRuns: number;
  open: number;
  /** "oldest 2 h ago · retries used up". */
  openNote: string;
  retriedOk: number;
  retriedOkRate: number;
  /** The commonest cause in the window; `null` when nothing failed. */
  mostCommon: { label: string; stage: string; runs: number } | null;
};

export type FailureQuery = {
  status: FailureFilter;
  search: string;
  kinds: FailureKind[];
  page: number;
};

export type FailurePage = {
  rows: GenerationFailure[];
  /** Every run matching the status, search and kinds, across all pages. */
  total: number;
  pages: number;
  counts: Record<FailureFilter, number>;
};

// --- Abuse reports ---------------------------------------------------------------------------

export type ReportStatus = 'open' | 'resolved' | 'dismissed';
export type ReportFilter = 'open' | 'resolved' | 'all';
export type ReportCategory = 'impersonation' | 'spam' | 'harassment' | 'copyright';

export const REPORT_CATEGORY_LABEL: Record<ReportCategory, string> = {
  impersonation: 'Impersonation',
  spam: 'Spam',
  harassment: 'Harassment',
  copyright: 'Copyright',
};

export type ReportedItem = { kind: 'public_link' | 'shared_resume'; ref: string };

export type AbuseReport = {
  /** "RPT-1042". */
  id: string;
  category: ReportCategory;
  item: ReportedItem;
  receivedAt: string;
  status: ReportStatus;
  /** Reporters stay anonymous to staff, always. */
  reporter: 'anonymous';
};

export type ReportAction = 'dismiss' | 'disable_link' | 'suspend_owner';

export type ReportOutcome = {
  action: ReportAction;
  reason: string;
  note: string;
  at: string;
};

/** What the report's side card adds (Figma 407:1357). */
export type AbuseReportDetail = AbuseReport & {
  reason: string;
  ownerRef: string;
  linkCreatedAt: string | null;
  views: number | null;
  prior: { count: number; note: string } | null;
  /** How it was settled, once it was. */
  outcome: ReportOutcome | null;
};

export type ReportStats = {
  open: number;
  openNote: string;
  resolved30d: number;
  resolvedNote: string;
  /** `null` when nothing was settled in the window. */
  medianResolveHours: number | null;
  targetHours: number;
};

export type ReportPage = {
  rows: AbuseReport[];
  total: number;
  pages: number;
  counts: Record<ReportFilter, number>;
};

// --- Audit log -------------------------------------------------------------------------------

export type AuditTargetType =
  'user' | 'prompt' | 'technology' | 'resume' | 'staff' | 'provider' | 'export';

export const AUDIT_TARGET_LABEL: Record<AuditTargetType, string> = {
  user: 'Users',
  prompt: 'Prompts',
  technology: 'Technology KB',
  resume: 'Resume content',
  staff: 'Staff',
  provider: 'Job providers',
  export: 'Exports',
};

/** One append-only audit row (Figma 408:1759). */
export type AuditEvent = {
  id: string;
  at: string;
  staff: { id: string; name: string; role: AdminRole };
  /** "Sent a password reset". */
  action: string;
  /** The row the board marks "Audited read": a staff member opened user content. */
  contentRead: boolean;
  /** What the target cell shows, already masked: "user ···4f2a", "tailor.rewrite v14". */
  target: { type: AuditTargetType; label: string };
  reason: string;
  /** The full address; the screen masks its middle. */
  ip: string;
};

export type AuditRange = '7d' | '30d' | '90d' | 'all';

export type AuditFilters = {
  range: AuditRange;
  /** A staff member's id, or every staff member. */
  staff: string;
  action: string;
  targetType: AuditTargetType | 'all';
  search: string;
};

export const EMPTY_AUDIT_FILTERS: AuditFilters = {
  range: '30d',
  staff: 'all',
  action: 'all',
  targetType: 'all',
  search: '',
};

export type AuditPage = {
  rows: AuditEvent[];
  /** `null` when the source can't count the whole range (the API pages by cursor). */
  total: number | null;
  /** With no total: how many rows the source loaded and pages through (the API's first 500). */
  loaded?: number;
  pages: number;
  /** What the filter menus offer: who appears in the log, and which actions. */
  staffOptions: { id: string; name: string }[];
  actionOptions: string[];
};

// --- Settings --------------------------------------------------------------------------------

export type AllowedNetwork = { cidr: string; label: string };

export type AdminSettings = {
  requireMfa: true;
  /** `null` until the signed-in member's first sign-in sets one up. */
  authenticator: { addedAt: string; lastUsedAt: string } | null;
  backupCodes: { unused: number; total: number };
  sessionTimeoutMinutes: number;
  reauthForSensitive: boolean;
  allowedNetworks: AllowedNetwork[];
  /** `null` when the server can't see the client's address. */
  currentIp: string | null;
  lastSignIn: { at: string; ip: string | null } | null;
  retention: { label: string; value: string }[];
};

export const SESSION_TIMEOUT_OPTIONS = [15, 30, 60, 120] as const;

export type AdminSettingsPatch = Partial<
  Pick<AdminSettings, 'sessionTimeoutMinutes' | 'reauthForSensitive' | 'allowedNetworks'>
>;

// --- Sign-in ---------------------------------------------------------------------------------

/**
 * What a staff sign-in step answers (toreview §171.13): the next step, or signed in. A new or reset
 * account sets up its authenticator (`enroll_totp`), then replaces its temporary password
 * (`change_password`); backup codes are handed over once, with the step after the set-up.
 */
export type AdminSignInResult =
  | { status: 'signed_in'; backupCodes?: string[] }
  | { status: 'mfa_required' }
  | { status: 'enroll_totp'; challenge: string; secret: string; otpauthUrl: string }
  | { status: 'change_password'; challenge: string; backupCodes?: string[] };

/** A new authenticator to scan: its secret, the otpauth link a QR code carries, and the step's challenge. */
export type AuthenticatorSetup = { challenge: string; secret: string; otpauthUrl: string };
