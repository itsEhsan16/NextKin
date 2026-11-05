import type {
  AdminDeletionRequest,
  AdminSecurityEvent,
  AdminStaffMember,
  AdminUserAction,
  AdminUserDetail,
  AdminUserRow,
  AdminUserStats,
} from '../../models/adminPeople';

import { daysAgo, daysFromNow, hoursAgo, minutesAgo } from './time';

/**
 * The People boards' records (Figma 404:614 Users, 406:2360 User detail, 408:2050 Staff & roles,
 * 408:2745 Deletion requests), as drawn. Relative times are relative to now, so "2 min ago" and
 * "3 days left" stay true; the boards were drawn on Nov 5, 2026, which the absolute dates assume.
 */

/** A wall-clock time on a board's day, in the viewer's own zone (the boards print local times). */
const date = (iso: string, time = '10:00') => new Date(`${iso}T${time}:00`).toISOString();

/** Users (404:882–404:1100): the eight rows the board draws, in its order. */
export const adminUsersFixture: AdminUserRow[] = [
  {
    id: 'usr_7f3c2b1da91e',
    name: 'Aarav Mehta',
    email: 'aarav.mehta@gmail.com',
    plan: 'pro',
    status: 'active',
    usage: { used: 38, limit: 100 },
    signedUpAt: date('2026-03-14'),
    lastActiveAt: minutesAgo(2),
    resumes: 12,
  },
  {
    id: 'usr_5b8e20c4d3f1',
    name: 'Sofia Rossi',
    email: 'sofia.rossi@outlook.com',
    plan: 'free',
    status: 'active',
    usage: { used: 9, limit: 10 },
    signedUpAt: date('2026-10-02'),
    lastActiveAt: hoursAgo(1),
    resumes: 3,
  },
  {
    id: 'usr_c1d94e7a2b60',
    name: 'Liam O’Connor',
    email: 'liam.oconnor@proton.me',
    plan: 'free',
    status: 'suspended',
    usage: { used: 10, limit: 10 },
    signedUpAt: date('2026-09-21'),
    lastActiveAt: daysAgo(6),
    resumes: 4,
  },
  {
    id: 'usr_93a07f6e1c28',
    name: 'Mei Tanaka',
    email: 'mei.tanaka@yahoo.co.jp',
    plan: 'pro',
    status: 'active',
    usage: { used: 61, limit: 100 },
    signedUpAt: date('2026-01-08'),
    lastActiveAt: daysAgo(1),
    resumes: 19,
  },
  {
    id: 'usr_2e6b9d0f47a5',
    name: 'Daniel Okafor',
    email: 'd.okafor@gmail.com',
    plan: 'free',
    status: 'deletion_pending',
    usage: { used: 2, limit: 10 },
    signedUpAt: date('2026-08-30'),
    lastActiveAt: daysAgo(12),
    resumes: 1,
  },
  {
    id: 'usr_f40c5a83e9b2',
    name: 'Hannah Weber',
    email: 'hannah.weber@web.de',
    plan: 'pro',
    status: 'comped',
    usage: { used: 14, limit: 100 },
    signedUpAt: date('2026-05-19'),
    lastActiveAt: hoursAgo(3),
    resumes: 7,
  },
  {
    id: 'usr_8a1e7c3b5d09',
    name: 'Carlos Ruiz',
    email: 'carlos.ruiz@gmail.com',
    plan: 'free',
    status: 'unverified',
    usage: { used: 0, limit: 10 },
    signedUpAt: date('2026-11-04'),
    lastActiveAt: daysAgo(1),
    resumes: 0,
  },
  {
    id: 'usr_6d2f8b4a0e73',
    name: 'Priya Nair',
    email: 'priya.nair@icloud.com',
    plan: 'free',
    status: 'active',
    usage: { used: 6, limit: 10 },
    signedUpAt: date('2026-07-11'),
    lastActiveAt: hoursAgo(5),
    resumes: 5,
  },
];

/** The Users board's headline cards (404:776–404:801). Platform totals: the rows are a sample. */
export const adminUserStatsFixture: AdminUserStats = {
  total: 48_212,
  newLast30: 2_418,
  active30: 21_904,
  active30Delta: { value: 4.1, unit: 'percent' },
  pro: 412,
  proNew: 38,
  comped: 6,
  suspended: 37,
  suspendedBy: { abuse: 21, fraud: 9, other: 7 },
  pendingDeletion: 3,
  nextDeletionDueInDays: 4,
};

const securityEvents: AdminSecurityEvent[] = [
  {
    id: 'sec_5',
    event: 'Signed in',
    result: 'success',
    ip: '102.89.xx.xx',
    device: 'Chrome on macOS',
    at: minutesAgo(30),
  },
  {
    id: 'sec_4',
    event: 'Password reset email sent',
    result: 'admin',
    ip: null,
    device: 'Requested by Priya R.',
    at: date('2026-11-03', '18:01'),
  },
  {
    id: 'sec_3',
    event: 'Failed sign-in, wrong password',
    result: 'failed',
    ip: '197.210.xx.xx',
    device: 'Safari on iPhone',
    at: date('2026-11-03', '17:58'),
  },
  {
    id: 'sec_2',
    event: 'New device signed in',
    result: 'success',
    ip: '41.58.xx.xx',
    device: 'Firefox on Windows',
    at: date('2026-10-12', '20:15'),
  },
  {
    id: 'sec_1',
    event: 'Email address verified',
    result: 'success',
    ip: '102.89.xx.xx',
    device: 'Chrome on macOS',
    at: date('2026-03-14', '10:02'),
  },
];

const adminActions: AdminUserAction[] = [
  {
    id: 'act_4',
    kind: 'password_reset',
    label: 'Password reset email sent',
    by: 'Priya R.',
    note: null,
    at: date('2026-11-03', '18:01'),
  },
  {
    id: 'act_3',
    kind: 'content_read',
    label: 'Viewed resume content',
    by: 'Priya R.',
    note: 'ticket SUP-2104',
    at: date('2026-08-30'),
  },
  {
    id: 'act_2',
    kind: 'usage_reset',
    label: 'Usage limits reset',
    by: 'Ana L.',
    note: 'goodwill credit',
    at: date('2026-07-12'),
  },
  {
    id: 'act_1',
    kind: 'email_changed',
    label: 'Email address changed',
    by: 'Ana L.',
    note: 'user request',
    at: date('2026-04-02'),
  },
];

/** Aarav Mehta's page (406:2360), as drawn. */
const aarav: Omit<AdminUserDetail, keyof AdminUserRow> = {
  emailVerified: true,
  billing: {
    period: 'monthly',
    since: date('2026-04-02'),
    country: 'DE',
    priceMinor: 1900,
    currency: 'USD',
    renewsAt: date('2026-12-02'),
    stripeCustomer: 'cus_Q2v7Lm8KfQ',
  },
  compedUntil: null,
  signInMethod: 'Email and password',
  mfa: 'off',
  deletionRequestedAt: null,
  meters: [
    {
      key: 'generation',
      label: 'Generations',
      description: 'Resume tailoring and rewrites',
      used: 38,
      limit: 100,
    },
    {
      key: 'cover_letter',
      label: 'Cover letters',
      description: 'Generated or rewritten',
      used: 6,
      limit: 30,
    },
    {
      key: 'ats_check',
      label: 'ATS checks',
      description: 'Resume scored against a job',
      used: 21,
      limit: 100,
    },
    {
      key: 'interview_set',
      label: 'Interview sets',
      description: 'Practice question sets',
      used: 2,
      limit: 10,
    },
  ],
  usageResetsAt: date('2026-12-01'),
  resumeList: [
    {
      id: 'res_a1',
      updatedAt: date('2026-11-02'),
      createdAt: date('2026-03-15'),
      pages: 2,
      template: 'Modern',
      source: 'PDF',
    },
    {
      id: 'res_a2',
      updatedAt: date('2026-10-18'),
      createdAt: date('2026-06-02'),
      pages: 1,
      template: 'Classic',
      source: 'PDF',
    },
    {
      id: 'res_a3',
      updatedAt: date('2026-09-09'),
      createdAt: date('2026-09-09'),
      pages: 2,
      template: 'Compact',
      source: 'DOCX upload',
    },
  ],
  securityEvents,
  securityEventCount: securityEvents.length,
  adminActions,
};

const TEMPLATES = ['Modern', 'Classic', 'Compact'];

/**
 * Any other user's page: the board draws only Aarav's, so the rest are built from their row, with
 * the plan's limits, their resume count as plain metadata, and no events yet (invented; see
 * `toreview.md` §171).
 */
export function adminUserDetailFixture(row: AdminUserRow): AdminUserDetail {
  if (row.id === adminUsersFixture[0]!.id) return { ...row, ...aarav };
  const pro = row.plan === 'pro';
  return {
    ...row,
    emailVerified: row.status !== 'unverified',
    billing:
      pro && row.status !== 'comped'
        ? {
            period: 'monthly',
            since: row.signedUpAt,
            country: 'US',
            priceMinor: 1900,
            currency: 'USD',
            renewsAt: daysFromNow(20),
            stripeCustomer: `cus_${row.id.slice(-10)}`,
          }
        : null,
    compedUntil: row.status === 'comped' ? daysFromNow(60) : null,
    signInMethod: 'Email and password',
    mfa: 'off',
    deletionRequestedAt: row.status === 'deletion_pending' ? daysAgo(2) : null,
    meters: [
      {
        key: 'generation',
        label: 'Generations',
        description: 'Resume tailoring and rewrites',
        used: row.usage?.used ?? 0,
        limit: row.usage?.limit ?? 10,
      },
      {
        key: 'cover_letter',
        label: 'Cover letters',
        description: 'Generated or rewritten',
        used: 0,
        limit: pro ? 30 : 3,
      },
      {
        key: 'ats_check',
        label: 'ATS checks',
        description: 'Resume scored against a job',
        used: 0,
        limit: pro ? 100 : 5,
      },
      {
        key: 'interview_set',
        label: 'Interview sets',
        description: 'Practice question sets',
        used: 0,
        limit: pro ? 10 : 1,
      },
    ],
    usageResetsAt: date('2026-12-01'),
    resumeList: Array.from({ length: row.resumes ?? 0 }, (_, index) => ({
      id: `${row.id}_res${index + 1}`,
      updatedAt: daysAgo(index * 9 + 2),
      createdAt: daysAgo(index * 9 + 20),
      pages: index % 2 === 0 ? 2 : 1,
      template: TEMPLATES[index % TEMPLATES.length]!,
      source: 'PDF',
    })),
    securityEvents: [],
    securityEventCount: 0,
    adminActions: [],
  };
}

/** What "Open read-only" shows for a resume (invented sample copy; the board draws no viewer). */
export function adminResumeContentFixture(name: string, resumeId: string) {
  return {
    resumeId,
    title: `${name} · resume`,
    sections: [
      {
        heading: 'Summary',
        lines: ['Product-minded engineer with six years building data-heavy web apps.'],
      },
      {
        heading: 'Experience',
        lines: [
          'Senior Engineer, Lumen Labs (2023–now): led the billing rewrite.',
          'Engineer, Northwind (2020–2023): shipped the reporting suite.',
        ],
      },
      { heading: 'Skills', lines: ['TypeScript, React, Node.js, PostgreSQL, AWS'] },
    ],
  };
}

/** Staff & roles (408:2050): the ten members, in the board's order. */
export const adminStaffFixture: AdminStaffMember[] = [
  {
    id: 'stf_ehsan',
    name: 'Ehsan',
    email: 'ehsan@nextkin.ai',
    role: 'super_admin',
    mfa: 'totp',
    lastActiveAt: minutesAgo(2),
    status: 'active',
  },
  {
    id: 'stf_ana',
    name: 'Ana L.',
    email: 'ana@nextkin.ai',
    role: 'admin',
    mfa: 'totp',
    lastActiveAt: minutesAgo(14),
    status: 'active',
  },
  {
    id: 'stf_tomas',
    name: 'Tomás R.',
    email: 'tomas@nextkin.ai',
    role: 'admin',
    mfa: 'totp',
    lastActiveAt: daysAgo(1),
    status: 'active',
  },
  {
    id: 'stf_marco',
    name: 'Marco K.',
    email: 'marco@nextkin.ai',
    role: 'curator',
    mfa: 'totp',
    lastActiveAt: hoursAgo(1),
    status: 'active',
  },
  {
    id: 'stf_lena',
    name: 'Lena S.',
    email: 'lena@nextkin.ai',
    role: 'curator',
    mfa: 'totp',
    lastActiveAt: hoursAgo(3),
    status: 'active',
  },
  {
    id: 'stf_yusuf',
    name: 'Yusuf A.',
    email: 'yusuf@nextkin.ai',
    role: 'curator',
    mfa: 'totp',
    lastActiveAt: daysAgo(3),
    status: 'active',
  },
  {
    id: 'stf_priya',
    name: 'Priya R.',
    email: 'priya@nextkin.ai',
    role: 'support',
    mfa: 'totp',
    lastActiveAt: minutesAgo(0),
    status: 'active',
  },
  {
    id: 'stf_chloe',
    name: 'Chloe B.',
    email: 'chloe@nextkin.ai',
    role: 'support',
    mfa: 'totp',
    lastActiveAt: minutesAgo(35),
    status: 'active',
  },
  {
    id: 'stf_kenji',
    name: 'Kenji T.',
    email: 'kenji@nextkin.ai',
    role: 'support',
    mfa: 'totp',
    lastActiveAt: daysAgo(1),
    status: 'active',
  },
  {
    id: 'stf_amara',
    name: 'Amara N.',
    email: 'amara@nextkin.ai',
    role: 'support',
    mfa: 'totp',
    lastActiveAt: daysAgo(6),
    status: 'active',
  },
];

const request = (
  id: string,
  origin: 'user' | 'admin',
  requested: number,
  status: AdminDeletionRequest['status'],
  tookDays?: number,
): AdminDeletionRequest => ({
  id: `del_${id}`,
  userId: `usr_${id.padStart(12, '0')}`,
  origin,
  requestedAt: daysAgo(requested),
  dueAt: requested > 30 ? daysAgo(requested - 30) : daysFromNow(30 - requested),
  status,
  completedAt: tookDays === undefined ? null : daysAgo(requested - tookDays),
});

/**
 * Deletion requests (408:2745): the three open and the first three completed are the board's;
 * the other fifteen completed ones make up its 21 ("Page 1 of 4"), with durations that give its
 * 6.2-day average (invented; see `toreview.md` §171).
 */
export const adminDeletionFixture: AdminDeletionRequest[] = [
  request('4f2a', 'user', 27, 'purging'),
  request('91c7', 'admin', 16, 'signed_out'),
  request('0b3e', 'user', 2, 'scheduled'),
  request('7d20', 'user', 38, 'completed', 6),
  request('c815', 'admin', 44, 'completed', 5),
  request('2a6d', 'user', 51, 'completed', 6),
  ...[7, 6, 6, 7, 5, 6, 7, 6, 6, 7, 6, 6, 7, 6, 7].map((took, index) =>
    request(
      [
        'e3b1',
        '58c0',
        'a9d4',
        '1f7e',
        'b62c',
        '07ad',
        'd4e9',
        '3c58',
        '9a1b',
        'f0e2',
        '64d7',
        'c3a0',
        '2b9f',
        '8e15',
        '5d6c',
      ][index]!,
      index % 3 === 0 ? 'admin' : 'user',
      58 + index * 6,
      'completed',
      took,
    ),
  ),
];
