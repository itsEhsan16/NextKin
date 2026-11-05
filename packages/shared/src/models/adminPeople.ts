import type { AdminDelta, AdminRole } from './admin';

/**
 * The admin portal's People area (Figma 404:614–408:2745): users, one user, staff and roles, and
 * deletion requests. A field the backend doesn't serve yet is `null`, and the screen says so
 * rather than showing a guess (`toreview.md` §171.4).
 */

export type AdminUserPlan = 'free' | 'pro';

/** How the Users board labels an account (404:614): one status, the most pressing first. */
export type AdminUserStatus = 'active' | 'suspended' | 'deletion_pending' | 'comped' | 'unverified';

/** The server's suspend and reactivate reason codes (`statusBody` in `routes/admin.ts`). */
export type SuspendReason = 'abuse' | 'fraud' | 'chargeback' | 'legal' | 'user_request' | 'other';

export const SUSPEND_REASONS: readonly { id: SuspendReason; label: string; description: string }[] =
  [
    { id: 'abuse', label: 'Abuse', description: 'Harassment, spam or misuse of the AI tools' },
    { id: 'fraud', label: 'Fraud', description: 'Stolen card, fake identity or account farming' },
    {
      id: 'chargeback',
      label: 'Chargeback',
      description: 'A payment was disputed with the card issuer',
    },
    {
      id: 'legal',
      label: 'Legal',
      description: 'Court order, regulator or law-enforcement request',
    },
    {
      id: 'user_request',
      label: 'User request',
      description: 'The user asked us to lock their account',
    },
    { id: 'other', label: 'Other', description: 'Explain in the internal note' },
  ];

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  plan: AdminUserPlan | null;
  status: AdminUserStatus;
  /** This month's generations against the plan's limit. */
  usage: { used: number; limit: number } | null;
  signedUpAt: string;
  lastActiveAt: string | null;
  resumes: number | null;
};

export type AdminUsersFilter = 'all' | 'free' | 'pro' | 'suspended' | 'deletion_pending';

export type AdminUsersQuery = {
  filter: AdminUsersFilter;
  q: string;
  /** By signed-up date; `null` keeps the source's own order (the board's rows, as drawn). */
  sort: 'asc' | 'desc' | null;
  page: number;
};

export type AdminUsersPage = {
  rows: AdminUserRow[];
  /** Every row the query matches, across pages. */
  matched: number;
  page: number;
  pages: number;
  /** `false` when the source can't answer this query; `unserved` says why. */
  served: boolean;
  /**
   * Why a page isn't served: `search` when the source can only search (the server needs two
   * characters to list anyone), `filter` when it can't apply the chosen tab (no plan per row).
   */
  unserved?: 'search' | 'filter';
};

/** The Users board's headline cards (404:776–404:801): platform totals, not the page's rows. */
export type AdminUserStats = {
  total: number;
  newLast30: number;
  active30: number;
  /** Against the previous 30 days; `null` when there is nothing to compare. */
  active30Delta: AdminDelta | null;
  pro: number;
  proNew: number;
  comped: number;
  suspended: number;
  suspendedBy: { abuse: number; fraud: number; other: number };
  pendingDeletion: number;
  nextDeletionDueInDays: number | null;
};

export type AdminUsageMeter = {
  key: 'generation' | 'cover_letter' | 'ats_check' | 'interview_set';
  label: string;
  description: string;
  used: number;
  limit: number;
};

export type AdminUserResume = {
  id: string;
  updatedAt: string;
  createdAt: string;
  /** From the latest finished render; `null` for a resume never rendered. */
  pages: number | null;
  /** `null` when the resume names no template. */
  template: string | null;
  /** "PDF", or "DOCX upload" for one the user brought. */
  source: string;
};

export type AdminSecurityEvent = {
  id: string;
  event: string;
  result: 'success' | 'admin' | 'failed';
  /** Masked to its first two octets, as the board prints it. */
  ip: string | null;
  device: string;
  at: string;
};

export type AdminUserActionKind =
  | 'password_reset'
  | 'content_read'
  | 'usage_reset'
  | 'email_changed'
  | 'suspended'
  | 'reactivated'
  | 'comped'
  | 'deletion_requested';

export type AdminUserAction = {
  id: string;
  kind: AdminUserActionKind;
  label: string;
  by: string;
  /** "ticket SUP-2104", "goodwill credit". */
  note: string | null;
  at: string;
};

export type AdminUserBilling = {
  period: 'monthly' | 'annual';
  since: string;
  country: string;
  priceMinor: number;
  currency: string;
  renewsAt: string | null;
  stripeCustomer: string;
};

export type AdminUserDetail = AdminUserRow & {
  emailVerified: boolean;
  billing: AdminUserBilling | null;
  /** Comped Pro runs until this date. */
  compedUntil: string | null;
  signInMethod: string | null;
  mfa: 'off' | 'totp' | null;
  deletionRequestedAt: string | null;
  meters: AdminUsageMeter[] | null;
  usageResetsAt: string | null;
  /** The resumes' metadata only; content opens through the reason-gated dialog. */
  resumeList: AdminUserResume[] | null;
  securityEvents: AdminSecurityEvent[];
  securityEventCount: number;
  adminActions: AdminUserAction[] | null;
};

/** A resume opened read-only through the reason dialog (407:2782). */
export type AdminResumeContent = {
  resumeId: string;
  title: string;
  sections: { heading: string; lines: string[] }[];
};

/** An invite's answer: the member, and their temporary password, shown once. */
export type StaffInvite = { member: AdminStaffMember; temporaryPassword: string; emailed: boolean };

export type AdminStaffMember = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  mfa: 'totp' | 'none';
  /** `null` for someone who has never signed in (an invite not yet taken up). */
  lastActiveAt: string | null;
  status: 'active' | 'invited' | 'disabled';
};

export type AdminDeletionStatus = 'purging' | 'signed_out' | 'scheduled' | 'completed';

export type AdminDeletionRequest = {
  id: string;
  userId: string;
  origin: 'user' | 'admin';
  requestedAt: string;
  dueAt: string;
  status: AdminDeletionStatus;
  completedAt: string | null;
};

export type AdminDeletionFilter = 'all' | 'open' | 'completed';

/**
 * The deletion page's cards (408:2843), over every request the source holds: there is no
 * reporting window.
 */
export type AdminDeletionStats = {
  open: number;
  oldestOpenAt: string | null;
  /** Open requests past their 30-day limit: a missed deadline, never counted as "due soon". */
  overdue: number;
  /** Open requests due in the next seven days, not yet overdue. */
  dueIn7Days: number;
  /** The soonest due date that hasn't passed. */
  nextDueAt: string | null;
  /** Completed requests finished within 30 days of being made. */
  completed30: number;
  /** Completed requests finished more than 30 days after being made. */
  completedPastLimit: number;
  /** Average days from request to the last row purged, over every completed request. */
  averageDays: number | null;
};
