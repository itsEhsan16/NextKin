import type {
  AbuseReportDetail,
  AdminSettings,
  AuditEvent,
  AuditTargetType,
  FailureDetail,
  FailureKind,
  FailureStage,
  FailureStats,
  GenerationFailure,
  ReportCategory,
  ReportStats,
} from '../../models/adminTrust';
import type { AdminRole } from '../../models/admin';

/**
 * Trust & safety on fixtures (Figma 406:1195, 407:946, 408:1531, 409:1500). Every row the boards
 * draw is here as drawn. The boards also state totals their pages don't draw (461 failed runs on
 * 52 pages, 16 reports, 2,204 audit events on 184 pages), so a small deterministic generator adds
 * the undrawn rows behind them, older than every drawn row, so paging and filters have something
 * real to work on. The generated rows are invented (`toreview.md` §171).
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const NOW = Date.now();

const ago = (ms: number) => new Date(NOW - ms).toISOString();

/** A local wall-clock time `days` before today: the boards print local dates for reports. */
function localAt(days: number, hours: number, minutes: number): string {
  const date = new Date(NOW);
  date.setDate(date.getDate() - days);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

/** A UTC time `days` before today's UTC date: the audit log prints UTC. */
function utcAt(days: number, hours: number, minutes: number, seconds: number): string {
  const date = new Date(NOW);
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() - days,
      hours,
      minutes,
      seconds,
    ),
  ).toISOString();
}

/** A small, stable pseudo-random sequence, so generated rows are the same on every load. */
function sequence(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

const hex = (next: () => number, length: number) =>
  Array.from({ length }, () => Math.floor(next() * 16).toString(16)).join('');

// --- Generation failures ---------------------------------------------------------------------

const PIPELINE: Record<FailureKind, string[]> = {
  tailor: ['resume.parse', 'jd.structure', 'tailor.rewrite', 'ai.review', 'render'],
  resume_build: ['resume.parse', 'build.compose', 'ai.review', 'render'],
  cover_letter: ['resume.parse', 'jd.structure', 'cover.write', 'ai.review', 'render'],
  ats_check: ['resume.parse', 'jd.structure', 'ats.score'],
  interview: ['resume.parse', 'jd.structure', 'interview.plan'],
};

const DONE: Record<string, { detail: string; seconds: number }> = {
  'quota.reserve': { detail: 'Reserved one generation from the plan quota', seconds: 0.1 },
  'resume.parse': { detail: 'Parsed 2 pages, 14 sections', seconds: 1.2 },
  'jd.structure': { detail: 'Structured the job description · schema v2', seconds: 2.9 },
  'build.compose': { detail: 'Composed 6 sections from the profile', seconds: 3.4 },
  'tailor.rewrite': { detail: 'Rewrote 11 bullets against the job', seconds: 8.2 },
  'cover.write': { detail: 'Drafted 4 paragraphs', seconds: 5.1 },
  'ai.review': { detail: 'Reviewed 18 proposed edits', seconds: 4 },
  'ats.score': { detail: 'Scored 42 keywords', seconds: 1.6 },
  'interview.plan': { detail: 'Planned 12 questions', seconds: 6.3 },
  render: { detail: 'Typeset 2 pages', seconds: 2.2 },
};

const ERROR: Record<
  string,
  { label: string; detail: string; message: (a: number, m: number) => string }
> = {
  LLM_TIMEOUT: {
    label: 'Timed out',
    detail: 'Timed out after 60 s on all 3 attempts',
    message: (a, m) => `provider did not respond within 60 s (attempt ${a} of ${m})`,
  },
  RENDER_FAILED: {
    label: 'Render failed',
    detail: 'The typesetter refused the document on all 3 attempts',
    message: (a, m) => `typesetter exited with an error (attempt ${a} of ${m})`,
  },
  SCHEMA_INVALID: {
    label: 'Invalid output',
    detail: 'The model’s output failed schema validation on all 3 attempts',
    message: (a, m) => `output did not match the stage schema (attempt ${a} of ${m})`,
  },
  QUOTA_RACE: {
    label: 'Quota conflict',
    detail: 'Another run reserved the same quota slot',
    message: (a, m) => `quota reservation conflicted with a concurrent run (attempt ${a} of ${m})`,
  },
  PARSE_EMPTY: {
    label: 'No text',
    detail: 'No text was found in the uploaded file',
    message: (a, m) => `parser returned no text (attempt ${a} of ${m})`,
  },
};

const PROMPTS: Record<string, { version: number; publishedDaysAgo: number }> = {
  'tailor.rewrite': { version: 14, publishedDaysAgo: 8 },
  'ai.review': { version: 7, publishedDaysAgo: 1 },
  'cover.write': { version: 9, publishedDaysAgo: 21 },
  'jd.structure': { version: 5, publishedDaysAgo: 3 },
  'interview.plan': { version: 4, publishedDaysAgo: 30 },
  'build.compose': { version: 6, publishedDaysAgo: 17 },
};

/** The prompt behind a stage, or the kind's main prompt when the failing stage has none. */
const MAIN_PROMPT: Record<FailureKind, string> = {
  tailor: 'tailor.rewrite',
  resume_build: 'build.compose',
  cover_letter: 'cover.write',
  ats_check: 'jd.structure',
  interview: 'interview.plan',
};

type DrawnFailure = [
  suffix: string,
  kind: FailureKind,
  stage: string,
  code: string,
  user: string,
  attempts: number,
  minutesAgo: number,
  status: GenerationFailure['status'],
];

/** The nine rows Figma 406:1293 draws, newest first. */
const DRAWN_FAILURES: DrawnFailure[] = [
  ['7b3e', 'tailor', 'tailor.rewrite', 'LLM_TIMEOUT', '4f2a', 3, 12, 'open'],
  ['c51a', 'tailor', 'tailor.rewrite', 'LLM_TIMEOUT', '9c10', 3, 38, 'open'],
  ['0e92', 'resume_build', 'render', 'RENDER_FAILED', '71be', 3, 60, 'retrying'],
  ['a4d7', 'cover_letter', 'ai.review', 'SCHEMA_INVALID', '2d88', 3, 120, 'open'],
  ['5f13', 'ats_check', 'jd.structure', 'LLM_TIMEOUT', 'e1d0', 3, 180, 'open'],
  ['91cc', 'tailor', 'quota.reserve', 'QUOTA_RACE', 'b3a6', 1, 240, 'retrying'],
  ['d2f0', 'interview', 'interview.plan', 'SCHEMA_INVALID', '6c4e', 3, 360, 'open'],
  ['38ab', 'tailor', 'render', 'RENDER_FAILED', 'f07d', 3, 540, 'resolved'],
  ['e7c2', 'resume_build', 'resume.parse', 'PARSE_EMPTY', '8a19', 3, 660, 'resolved'],
];

/** The board's totals: 461 failed runs, 7 of them open. */
const FAILURE_TOTAL = 461;
const UNDRAWN_OPEN = 2;

function failedStageOf(kind: FailureKind, code: string, next: () => number): string {
  if (code === 'QUOTA_RACE') return 'quota.reserve';
  if (code === 'PARSE_EMPTY') return 'resume.parse';
  if (code === 'RENDER_FAILED') return 'render';
  const llm = PIPELINE[kind].filter((s) => s !== 'resume.parse' && s !== 'render');
  return llm[Math.floor(next() * llm.length)] ?? PIPELINE[kind][0]!;
}

function buildFailures(): GenerationFailure[] {
  const rows: GenerationFailure[] = DRAWN_FAILURES.map(
    ([suffix, kind, stage, code, user, attempts, minutes, status], index) => ({
      id: `run_${(9_000_000 + index * 7919).toString(16)}${suffix}`,
      kind,
      stage,
      errorCode: code,
      userRef: `usr_${(4_000_000 + index * 6151).toString(16)}${user}`,
      attempts,
      maxAttempts: 3,
      failedAt: ago(minutes * MINUTE),
      status,
    }),
  );
  const next = sequence(0x7a11);
  const kinds = Object.keys(PIPELINE) as FailureKind[];
  const codes = [
    'LLM_TIMEOUT',
    'LLM_TIMEOUT',
    'SCHEMA_INVALID',
    'RENDER_FAILED',
    'QUOTA_RACE',
    'PARSE_EMPTY',
  ];
  const undrawn = FAILURE_TOTAL - rows.length;
  for (let i = 0; i < undrawn; i += 1) {
    const kind = kinds[Math.floor(next() * kinds.length)]!;
    const code = codes[Math.floor(next() * codes.length)]!;
    // Spread over the rest of the 30-day window, older than every drawn row.
    const minutes = 720 + Math.floor((i / undrawn) * 29 * 24 * 60) + Math.floor(next() * 50);
    rows.push({
      id: `run_${hex(next, 12)}`,
      kind,
      stage: failedStageOf(kind, code, next),
      errorCode: code,
      userRef: `usr_${hex(next, 12)}`,
      attempts: code === 'QUOTA_RACE' ? 1 : 3,
      maxAttempts: 3,
      failedAt: ago(minutes * MINUTE),
      status: i < UNDRAWN_OPEN ? 'open' : 'resolved',
    });
  }
  return rows;
}

export const adminFailuresFixture: GenerationFailure[] = buildFailures();

/** The drawer's detail for a run (Figma 406:1691), built from its row. */
export function failureDetailFixture(row: GenerationFailure): FailureDetail {
  const pipeline = PIPELINE[row.kind].includes(row.stage)
    ? PIPELINE[row.kind]
    : [row.stage, ...PIPELINE[row.kind]];
  const failedAt = pipeline.indexOf(row.stage);
  const error = ERROR[row.errorCode] ?? ERROR.LLM_TIMEOUT!;
  const stages: FailureStage[] = pipeline.map((name, index) => {
    if (index < failedAt) return { name, outcome: 'done', ...DONE[name]! };
    if (index === failedAt)
      return { name, outcome: 'failed', detail: error.detail, label: error.label };
    return {
      name,
      outcome: 'skipped',
      detail: 'Skipped because an earlier stage failed',
      label: 'Skipped',
    };
  });
  const promptName = PROMPTS[row.stage] ? row.stage : MAIN_PROMPT[row.kind];
  const prompt = PROMPTS[promptName] ?? { version: 1, publishedDaysAgo: 30 };
  // The drawn run c51a took 3 min 12 s from start to failure; the rest take the same.
  const ended = new Date(row.failedAt).getTime();
  const tail = row.id.slice(-4);
  const requestTail = tail === 'c51a' ? '93ab' : row.id.slice(-8, -4);
  return {
    ...row,
    stages,
    error: {
      message: error.message(row.attempts, row.maxAttempts),
      requestRef: `req_${row.id.slice(4, 12)}${requestTail}`,
      retryPolicy: '3 × exponential backoff, 2 s → 8 s',
    },
    prompt: {
      name: promptName,
      version: prompt.version,
      publishedAt: ago(prompt.publishedDaysAgo * DAY),
    },
    model: 'claude-sonnet · default tier',
    tokensIn: tail === 'c51a' ? 3912 : 2400 + (parseInt(tail, 16) % 2400),
    tokensOut: 0,
    startedAt: new Date(ended - 192_000).toISOString(),
    endedAt: row.failedAt,
  };
}

/** The four cards on Figma 406:1356, as drawn. `open` is recounted from the rows. */
export const adminFailureStatsFixture: FailureStats = {
  failed30d: 461,
  failedRate: 0.024,
  totalRuns: 18_904,
  open: 7,
  openNote: 'oldest 2 h ago · retries used up',
  retriedOk: 412,
  retriedOkRate: 0.89,
  mostCommon: { label: 'Timeout', stage: 'tailor.rewrite', runs: 176 },
};

// --- Abuse reports ---------------------------------------------------------------------------

type DrawnReport = [
  id: string,
  category: ReportCategory,
  kind: 'public_link' | 'shared_resume',
  ref: string,
  received: [days: number, hours: number, minutes: number],
  status: AbuseReportDetail['status'],
];

/** The eight rows Figma 407:1180 draws, newest first, then the eight on page 2 it doesn't. */
const REPORTS: DrawnReport[] = [
  ['RPT-1042', 'impersonation', 'public_link', 'k3p9', [0, 6, 12], 'open'],
  ['RPT-1041', 'spam', 'public_link', 'a7f2', [1, 22, 40], 'open'],
  ['RPT-1039', 'harassment', 'shared_resume', '5d1c', [2, 14, 5], 'resolved'],
  ['RPT-1038', 'copyright', 'shared_resume', 'e09b', [3, 9, 51], 'resolved'],
  ['RPT-1036', 'spam', 'public_link', '77ad', [5, 18, 22], 'dismissed'],
  ['RPT-1035', 'impersonation', 'public_link', 'c4e8', [6, 11, 3], 'resolved'],
  ['RPT-1033', 'spam', 'shared_resume', '2b6f', [7, 16, 47], 'dismissed'],
  ['RPT-1031', 'copyright', 'public_link', '90fa', [9, 8, 30], 'dismissed'],
  ['RPT-1029', 'harassment', 'public_link', '3e51', [10, 13, 18], 'dismissed'],
  ['RPT-1027', 'spam', 'public_link', 'b8d0', [12, 7, 44], 'dismissed'],
  ['RPT-1026', 'impersonation', 'shared_resume', '61fa', [13, 19, 2], 'resolved'],
  ['RPT-1024', 'spam', 'public_link', '0c7e', [15, 10, 26], 'dismissed'],
  ['RPT-1022', 'copyright', 'public_link', 'd4a3', [17, 15, 9], 'resolved'],
  ['RPT-1021', 'spam', 'shared_resume', '9f20', [19, 9, 37], 'dismissed'],
  ['RPT-1019', 'harassment', 'public_link', '7a6b', [22, 12, 55], 'dismissed'],
  ['RPT-1017', 'spam', 'public_link', 'e3c4', [26, 17, 13], 'dismissed'],
];

const REASONS: Record<ReportCategory, string> = {
  impersonation: '“Someone has published a resume under my name and photo.”',
  spam: '“This link is advertising a paid service, not a resume.”',
  harassment: '“The summary on this resume names me and is abusive.”',
  copyright: '“This resume copies the layout and text of my own published portfolio.”',
};

/** How each settled report ended, so Resolved, 30 days reads 9 dismissed · 4 links · 1 suspension. */
const OUTCOMES: Record<string, 'disable_link' | 'suspend_owner'> = {
  'RPT-1039': 'suspend_owner',
  'RPT-1038': 'disable_link',
  'RPT-1035': 'disable_link',
  'RPT-1026': 'disable_link',
  'RPT-1022': 'disable_link',
};

/** RPT-1042 arrived at 06:12 "today"; before then the reports move back a day together. */
const REPORT_SHIFT = new Date(localAt(0, 6, 12)).getTime() > NOW ? 1 : 0;

/** A local time today, or yesterday when that time hasn't come yet. */
const pastLocalAt = (hours: number, minutes: number) =>
  new Date(localAt(0, hours, minutes)).getTime() > NOW
    ? localAt(1, hours, minutes)
    : localAt(0, hours, minutes);

function buildReports(): AbuseReportDetail[] {
  return REPORTS.map(([id, category, kind, ref, [days, hours, minutes], status], index) => {
    const receivedAt = localAt(days + REPORT_SHIFT, hours, minutes);
    const drawn = id === 'RPT-1042';
    const action = status === 'dismissed' ? 'dismiss' : OUTCOMES[id];
    return {
      id,
      category,
      item: {
        kind,
        ref: `${kind === 'public_link' ? 'lnk' : 'res'}_${(5_100_000 + index * 4093).toString(16)}${ref}`,
      },
      receivedAt,
      status,
      reporter: 'anonymous',
      reason: drawn
        ? '“This public resume uses my name, my photo and my employment history at Lumen Labs. I never created it and I want it taken down.”'
        : REASONS[category],
      ownerRef: drawn
        ? 'usr_3d0f124f2a'
        : `usr_${(3_300_000 + index * 3571).toString(16)}${ref.split('').reverse().join('')}`,
      linkCreatedAt: drawn ? localAt(6, 10, 0) : localAt(days + 4, 12, 0),
      views: drawn ? 214 : 20 + ((index * 37) % 180),
      prior: drawn ? { count: 1, note: 'Spam · dismissed Sep 12' } : null,
      outcome:
        status === 'open' || !action
          ? null
          : {
              action,
              reason:
                action === 'dismiss'
                  ? 'Not a violation'
                  : category === 'copyright'
                    ? 'Copyright'
                    : 'Policy violation',
              note: '',
              at: localAt(Math.max(0, days - 1), 12, 0),
            },
    };
  });
}

export const adminReportsFixture: AbuseReportDetail[] = buildReports();

/** The three cards on Figma 407:1044, as drawn. `open` is recounted from the reports. */
export const adminReportStatsFixture: ReportStats = {
  open: 2,
  openNote: 'oldest received 3 h ago',
  resolved30d: 14,
  resolvedNote: '9 dismissed · 4 links disabled · 1 suspension',
  medianResolveHours: 5,
  targetHours: 24,
};

// --- Audit log -------------------------------------------------------------------------------

type Staff = { id: string; name: string; role: AdminRole; ip: string };

const STAFF: Record<string, Staff> = {
  priya: { id: 'stf_8a41c0k9m2', name: 'Priya R.', role: 'support', ip: '102.89.53.14' },
  ehsan: { id: 'stf_0b2e77e5h1', name: 'Ehsan', role: 'super_admin', ip: '41.216.88.7' },
  marco: { id: 'stf_5c9d13m4k7', name: 'Marco K.', role: 'curator', ip: '88.12.140.203' },
  ana: { id: 'stf_7e30a2a1l5', name: 'Ana L.', role: 'admin', ip: '73.158.12.90' },
};

type DrawnEvent = [
  when: [days: number, h: number, m: number, s: number],
  staff: keyof typeof STAFF,
  action: string,
  type: AuditTargetType,
  target: string,
  reason: string,
];

/** The twelve rows Figma 408:1759 draws, newest first. */
const DRAWN_EVENTS: DrawnEvent[] = [
  [[0, 10, 42, 18], 'priya', 'Sent a password reset', 'user', 'user ···4f2a', 'user_request'],
  [
    [0, 10, 15, 2],
    'ehsan',
    'Published prompt',
    'prompt',
    'tailor.rewrite v14',
    'Eval passed · 0.91',
  ],
  [
    [0, 9, 58, 40],
    'marco',
    'Approved KB change',
    'technology',
    'tech ···e1d0',
    'Source cited · nextjs.org/blog',
  ],
  [
    [0, 9, 31, 55],
    'priya',
    'Opened resume content',
    'resume',
    'resume ···9c10',
    'Ticket 2231 · export layout broken',
  ],
  [[0, 9, 2, 11], 'ehsan', 'Suspended an account', 'user', 'user ···71be', 'abuse · RPT-1029'],
  [
    [1, 18, 20, 37],
    'ana',
    'Reactivated an account',
    'user',
    'user ···3a7c',
    'user_request · appeal accepted',
  ],
  [
    [1, 16, 5, 49],
    'ehsan',
    'Rolled back prompt',
    'prompt',
    'ai.review v8 → v7',
    'Eval drift after publish',
  ],
  [
    [1, 14, 48, 3],
    'ehsan',
    'Changed role',
    'staff',
    'staff ···k9m2',
    'Priya R. · Support → Curator',
  ],
  [
    [1, 11, 12, 26],
    'ehsan',
    'Replaced provider key',
    'provider',
    'provider adzuna',
    '90-day key rotation',
  ],
  [
    [2, 17, 30, 14],
    'ana',
    'Granted comp',
    'user',
    'user ···b3a6',
    'Pro · 3 months · partner program',
  ],
  [[2, 9, 0, 0], 'ana', 'Processed deletion', 'user', 'user ···6c4e', 'Deletion request DR-208'],
  [[3, 15, 44, 51], 'ana', 'Downloaded export', 'export', 'export users.csv', '—'],
];

/**
 * The board's newest event is at 10:42:18 UTC "today". Before that time of day it would sit in the
 * future, so the drawn rows move back a day together, keeping their times and order.
 */
const DRAWN_SHIFT = new Date(utcAt(0, 10, 42, 18)).getTime() > NOW ? 1 : 0;

/** The board's count for the last 30 days. */
const EVENTS_IN_30_DAYS = 2204;

/** What each role does, for the undrawn rows: an action, its target type and its reason. */
const ROUTINE: Record<keyof typeof STAFF, [string, AuditTargetType, string][]> = {
  priya: [
    ['Sent a password reset', 'user', 'user_request'],
    ['Opened resume content', 'resume', 'Support ticket'],
    ['Viewed a user', 'user', 'Support ticket'],
  ],
  ehsan: [
    ['Published prompt', 'prompt', 'Eval passed'],
    ['Suspended an account', 'user', 'abuse'],
    ['Changed role', 'staff', 'Team change'],
  ],
  marco: [
    ['Approved KB change', 'technology', 'Source cited'],
    ['Rejected KB change', 'technology', 'No source'],
    ['Published template', 'prompt', 'Certified ATS-safe'],
  ],
  ana: [
    ['Reactivated an account', 'user', 'user_request'],
    ['Granted comp', 'user', 'partner program'],
    ['Processed deletion', 'user', 'Deletion request'],
  ],
};

function buildEvents(): AuditEvent[] {
  const rows: AuditEvent[] = DRAWN_EVENTS.map(
    ([[d, h, m, s], who, action, type, label, reason], index) => {
      const staff = STAFF[who]!;
      return {
        id: `aud_${String(90_000 - index)}`,
        at: utcAt(d + DRAWN_SHIFT, h, m, s),
        staff: { id: staff.id, name: staff.name, role: staff.role },
        action,
        contentRead: action === 'Opened resume content',
        target: { type, label },
        reason,
        ip: staff.ip,
      };
    },
  );
  const next = sequence(0xa0d1);
  const people = Object.keys(STAFF) as (keyof typeof STAFF)[];
  const last = new Date(rows[rows.length - 1]!.at).getTime();
  const windowStart = NOW - 30 * DAY;
  const inWindow = EVENTS_IN_30_DAYS - rows.length;
  // The rest of the 30 days, then two more months behind it for the longer ranges.
  const total = inWindow + 2600;
  for (let i = 0; i < total; i += 1) {
    const who = people[Math.floor(next() * people.length)]!;
    const staff = STAFF[who]!;
    const [action, type, reason] = ROUTINE[who]![Math.floor(next() * 3)]!;
    const at =
      i < inWindow
        ? last - ((i + 1) / (inWindow + 1)) * (last - windowStart)
        : windowStart - ((i - inWindow + 1) / 2600) * 60 * DAY;
    const tail = hex(next, 4);
    // Drawn for every prompt row, so the sequence (and every row after) stays as it was.
    const version = type === 'prompt' ? 1 + Math.floor(next() * 14) : 0;
    // A template has no target type of its own (it files under prompts, as the API's rows do), so
    // its label names it as a template.
    const label =
      action === 'Published template'
        ? `template ···${tail}`
        : type === 'prompt'
          ? `prompt v${version}`
          : `${type === 'technology' ? 'tech' : type} ···${tail}`;
    rows.push({
      id: `aud_${String(89_988 - i)}`,
      at: new Date(Math.floor(at / 1000) * 1000).toISOString(),
      staff: { id: staff.id, name: staff.name, role: staff.role },
      action,
      contentRead: action === 'Opened resume content',
      target: { type, label },
      reason,
      ip: staff.ip,
    });
  }
  return rows;
}

export const adminAuditFixture: AuditEvent[] = buildEvents();

// --- Settings --------------------------------------------------------------------------------

/** Figma 409:1598, as drawn. */
export function adminSettingsFixture(): AdminSettings {
  // Oct 2 just gone: last year's while this year's is still ahead, so it never lands in the future.
  const added = new Date(NOW);
  added.setMonth(10 - 1, 2);
  if (added.getTime() > NOW) added.setFullYear(added.getFullYear() - 1);
  return {
    requireMfa: true,
    authenticator: { addedAt: added.toISOString(), lastUsedAt: pastLocalAt(9, 12) },
    backupCodes: { unused: 8, total: 10 },
    sessionTimeoutMinutes: 30,
    reauthForSensitive: true,
    allowedNetworks: [
      { cidr: '41.216.0.0/16', label: 'Office' },
      { cidr: '73.158.12.90', label: 'Ana L., remote' },
      { cidr: '102.89.0.0/16', label: 'Support team' },
    ],
    currentIp: '41.216.88.7',
    lastSignIn: { at: pastLocalAt(8, 57), ip: '41.216.88.7' },
    retention: [
      { label: 'Security events', value: 'Kept 2 years' },
      { label: 'Audit log', value: 'Kept indefinitely, append-only' },
      { label: 'Deleted accounts', value: 'Purged within 30 days' },
      { label: 'Generation logs', value: '90 days, then aggregates only' },
    ],
  };
}
