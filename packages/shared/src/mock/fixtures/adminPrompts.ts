import type {
  PromptDetail,
  PromptEditorTab,
  PromptEval,
  PromptStage,
  SandboxRun,
  SandboxSample,
} from '../../models/adminContent';

import { minutesAgo } from './time';

/**
 * The AI prompts boards' records (Figma 406:662, 407:3141), as drawn. The boards' sample figures
 * "only show the format". The prompt pages other than tailor.rewrite, the tabs other than System
 * prompt, older versions' text and the extra sandbox samples are made up in the same style and
 * listed in `toreview.md` §171.9.
 *
 * A prompt's dates are moments (a publish, an eval, a draft), so they're held at the board's day
 * and time in the viewer's own zone and shown in it: "Nov 5" reads Nov 5 everywhere, and a write
 * made now is dated the same way.
 */
const on = (date: string, time = '12:00') => new Date(`${date}T${time}:00`).toISOString();

export const promptStagesFixture: PromptStage[] = [
  {
    name: 'resume.parse',
    description: 'Turns an uploaded resume into structured sections',
    activeVersion: 9,
    draft: null,
    lastEval: { score: 0.97, version: 9, at: on('2026-10-28'), passed: true },
    threshold: 0.85,
    costPerRunUsd: 0.004,
    p95Seconds: 2.1,
    updatedAt: on('2026-10-28'),
    updatedBy: 'Marco K.',
  },
  {
    name: 'jd.structure',
    description: 'Extracts requirements and keywords from a job post',
    activeVersion: 5,
    draft: null,
    lastEval: { score: 0.93, version: 5, at: on('2026-11-03'), passed: true },
    threshold: 0.85,
    costPerRunUsd: 0.003,
    p95Seconds: 3.4,
    updatedAt: on('2026-11-03'),
    updatedBy: 'Ana L.',
  },
  {
    name: 'tailor.rewrite',
    description: 'Rewrites resume bullets toward the job',
    activeVersion: 14,
    draft: { version: 15, state: 'ready' },
    lastEval: { score: 0.91, version: 15, at: on('2026-11-05'), passed: true },
    threshold: 0.85,
    costPerRunUsd: 0.018,
    p95Seconds: 6.2,
    updatedAt: on('2026-11-05'),
    updatedBy: 'Marco K.',
  },
  {
    name: 'tailor.review',
    description: 'Checks the tailored page and proposes typed edits',
    activeVersion: 3,
    draft: null,
    lastEval: { score: 0.89, version: 3, at: on('2026-11-04'), passed: true },
    threshold: 0.85,
    costPerRunUsd: 0.011,
    p95Seconds: 5.8,
    updatedAt: on('2026-11-04'),
    updatedBy: 'Ehsan',
  },
  {
    name: 'ats.score',
    description: 'Scores keyword and format match against the job',
    activeVersion: 8,
    draft: null,
    lastEval: { score: 0.95, version: 8, at: on('2026-10-30'), passed: true },
    threshold: 0.85,
    costPerRunUsd: 0.002,
    p95Seconds: 1.4,
    updatedAt: on('2026-10-30'),
    updatedBy: 'Ana L.',
  },
  {
    name: 'cover.write',
    description: 'Drafts a cover letter from the resume and job',
    activeVersion: 7,
    draft: { version: 8, state: 'awaiting_eval' },
    lastEval: { score: 0.9, version: 7, at: on('2026-10-22'), passed: true },
    threshold: 0.85,
    costPerRunUsd: 0.012,
    p95Seconds: 7.9,
    updatedAt: on('2026-11-04'),
    updatedBy: 'Marco K.',
  },
  {
    name: 'interview.questions',
    description: 'Predicts interview questions with answer notes',
    activeVersion: 5,
    draft: null,
    lastEval: { score: 0.87, version: 5, at: on('2026-10-18'), passed: true },
    threshold: 0.85,
    costPerRunUsd: 0.009,
    p95Seconds: 5.1,
    updatedAt: on('2026-10-18'),
    updatedBy: 'Marco K.',
  },
  {
    name: 'zero.build',
    description: 'Builds a first resume from a guided interview',
    activeVersion: 4,
    draft: { version: 5, state: 'awaiting_eval' },
    lastEval: { score: 0.88, version: 4, at: on('2026-10-25'), passed: true },
    threshold: 0.85,
    costPerRunUsd: 0.014,
    p95Seconds: 8.4,
    updatedAt: on('2026-11-02'),
    updatedBy: 'Ana L.',
  },
  {
    name: 'assistant.chat',
    description: 'Answers questions about the user’s resume and jobs',
    activeVersion: 11,
    draft: null,
    lastEval: { score: 0.82, version: 11, at: on('2026-11-01'), passed: false },
    threshold: 0.85,
    costPerRunUsd: 0.006,
    p95Seconds: 3.9,
    updatedAt: on('2026-11-01'),
    updatedBy: 'Ehsan',
  },
];

export const promptsStatsFixture = {
  evalPassRate: { rate: 0.94, deltaPercent: 2.1 },
  costPerResume: { usd: 0.061, previousUsd: 0.065, previousLabel: 'October' },
};

const TAILOR_SYSTEM = [
  'You are NextKin’s resume tailoring writer.',
  'Rewrite each bullet so it speaks to the {{job.title}} role at {{job.company}}.',
  '',
  'Rules:',
  '- Keep every fact from the source bullet. Never invent employers, dates or numbers.',
  '- Lead with the outcome, then the action, then the tools used.',
  '- Use these keywords only where the resume supports them: {{keywords.ticked}}',
  '- Keep metrics exactly as stated. If a bullet has no metric, do not add one.',
  '- Write in {{resume.tense}} tense, at most {{settings.max_words}} words per bullet.',
  '- Match the register of {{job.seniority}} roles: plain, specific, no buzzwords.',
  '',
  'Return JSON that matches the output schema. For each bullet include',
  'the source id, the rewrite and the keywords it now covers.',
  'If a bullet cannot improve without inventing facts, return it unchanged.',
].join('\n');

/** v14's text isn't drawn; it stands in as what v15's change note says v15 tightened. */
const TAILOR_SYSTEM_V14 = TAILOR_SYSTEM.replace(
  '- Keep every fact from the source bullet. Never invent employers, dates or numbers.',
  '- Keep the facts from the source bullet.',
).replace(
  '- Use these keywords only where the resume supports them: {{keywords.ticked}}',
  '- Work in these keywords: {{keywords.ticked}}',
);

/** The other tabs aren't drawn; these stand in, in the same voice (`toreview.md` §171). */
const editorFor = (name: string, system: string): Record<PromptEditorTab, string> => ({
  system,
  user: [
    'Job: {{job.title}} at {{job.company}} ({{job.seniority}})',
    'Ticked keywords: {{keywords.ticked}}',
    '',
    'Bullets to rewrite:',
    '{{resume.bullets}}',
  ].join('\n'),
  schema: [
    '{',
    '  "bullets": [',
    '    { "sourceId": "string", "rewrite": "string", "keywords": ["string"] }',
    '  ]',
    '}',
  ].join('\n'),
  settings: [
    `stage: ${name}`,
    'model: claude-sonnet · default tier',
    'temperature: 0.2',
    'max_words: 28',
    'timeout: 60 s · 3 attempts',
  ].join('\n'),
});

/** v13 and older aren't drawn either: v14 without the outcome-first rule it added. */
const TAILOR_SYSTEM_V13 = TAILOR_SYSTEM_V14.replace(
  '- Lead with the outcome, then the action, then the tools used.\n',
  '',
);

/** One seeded resume's bullets, rewritten toward its matching seeded job. */
type SandboxCase = Omit<SandboxRun, 'ranAt' | 'version'>;

const RESUMES: SandboxSample[] = [
  { id: 'seed-pm-senior', label: 'Seeded: Senior product manager' },
  { id: 'seed-swe-mid', label: 'Seeded: Mid-level software engineer' },
  { id: 'seed-design-lead', label: 'Seeded: Design lead' },
];

const JOBS: SandboxSample[] = [
  { id: 'seed-stripe-pm', label: 'Seeded: Stripe — Product Manager, Payments' },
  { id: 'seed-shopify-swe', label: 'Seeded: Shopify — Senior Software Engineer' },
  { id: 'seed-figma-design', label: 'Seeded: Figma — Product Designer' },
];

/**
 * The sandbox's canned runs, one per seeded resume and the job it was seeded for. The board draws
 * the first; the other two are made up in the same voice. Other pairings have no canned run.
 */
export const sandboxCasesFixture: SandboxCase[] = [
  {
    resumeId: 'seed-pm-senior',
    jobId: 'seed-stripe-pm',
    bullets: [
      {
        before: 'Managed checkout team of 7; shipped one-click pay; conversion up 4.2%.',
        after: 'Led a 7-person checkout team to ship one-click payments, raising conversion 4.2%.',
        keywords: ['payments', 'conversion'],
      },
      {
        before: 'Worked with finance on moving billing to a new vendor.',
        after: 'Partnered with finance to migrate subscription billing to a new payments provider.',
        keywords: ['billing', 'cross-functional'],
      },
      {
        before: 'Ran 12 A/B tests on the pricing page in 2025.',
        after: 'Designed and ran 12 A/B experiments on the pricing page in 2025.',
        keywords: ['experimentation'],
      },
    ],
    total: 5,
    inputTokens: 3412,
    outputTokens: 812,
    costUsd: 0.018,
    latencySeconds: 6.2,
  },
  {
    resumeId: 'seed-swe-mid',
    jobId: 'seed-shopify-swe',
    bullets: [
      {
        before: 'Rewrote the order export job; it now finishes in 9 minutes instead of 40.',
        after: 'Rebuilt the order export job, cutting its run time from 40 minutes to 9.',
        keywords: ['performance'],
      },
      {
        before: 'On call for the payments API, about one week a month.',
        after: 'Shared on-call for the payments API about one week a month.',
        keywords: ['on-call', 'APIs'],
      },
      {
        before: 'Added tests to the checkout service.',
        after: 'Added automated tests to the checkout service.',
        keywords: ['testing'],
      },
    ],
    total: 6,
    inputTokens: 3187,
    outputTokens: 744,
    costUsd: 0.016,
    latencySeconds: 5.7,
  },
  {
    resumeId: 'seed-design-lead',
    jobId: 'seed-figma-design',
    bullets: [
      {
        before: 'Led a team of 4 designers on the mobile app redesign.',
        after: 'Led a team of 4 product designers through the mobile app redesign.',
        keywords: ['product design', 'leadership'],
      },
      {
        before: 'Built the design system used by 3 product teams.',
        after: 'Built the design system that 3 product teams use.',
        keywords: ['design systems'],
      },
      {
        before: 'Ran usability tests every sprint.',
        after: 'Ran usability tests every sprint.',
        keywords: ['user research'],
      },
    ],
    total: 4,
    inputTokens: 2968,
    outputTokens: 701,
    costUsd: 0.015,
    latencySeconds: 5.4,
  },
];

const BOARD_RUN: SandboxRun = {
  ...sandboxCasesFixture[0]!,
  ranAt: on('2026-11-05', '10:42'),
  version: 15,
};

const BOARD_CHECKS = [
  'Faithful to resume',
  'No invented claims',
  'Keyword coverage',
  'Format valid',
  'Tone',
] as const;

/** The checks a stage's eval set scores: the board's five for tailor.rewrite, two for the others. */
export const evalChecksFor = (name: string): readonly string[] =>
  name === 'tailor.rewrite' ? BOARD_CHECKS : ['Faithful to input', 'Format valid'];

/**
 * A prompt page as the mock holds it: the page, plus each version's own text and eval, so a
 * rollback shows the version it went back to and a new draft starts from the live text.
 */
export type PromptFixture = {
  detail: PromptDetail;
  texts: Map<number, Record<PromptEditorTab, string>>;
  evals: Map<number, PromptEval>;
};

const tailorRewriteFixture = (): PromptFixture => {
  const threshold = 0.85;
  const v15Eval: PromptEval = {
    version: 15,
    at: on('2026-11-05', '10:44'),
    score: 0.91,
    threshold,
    passed: true,
    cases: 120,
    baseline: { version: 14, score: 0.88 },
    checks: [
      { label: 'Faithful to resume', score: 0.96, threshold },
      { label: 'No invented claims', score: 1, threshold },
      { label: 'Keyword coverage', score: 0.84, threshold },
      { label: 'Format valid', score: 1, threshold },
      { label: 'Tone', score: 0.88, threshold },
    ],
  };
  // v1–v10 aren't drawn: two weeks apart going back from v11, each at or above the threshold it
  // passed to go live.
  const older = Array.from({ length: 10 }, (_, index) => ({
    version: 10 - index,
    status: 'retired' as const,
    createdAt: new Date(2026, 7, 29 - index * 14, 12).toISOString(),
    author: index % 2 ? 'Ana L.' : 'Marco K.',
    evalScore: index % 2 ? 0.85 : 0.86,
  }));
  const version = (
    v: number,
    status: 'draft' | 'active' | 'retired',
    day: string,
    author: string,
    evalScore: number,
  ) => ({ version: v, status, createdAt: on(day), author, evalScore });
  const detail: PromptDetail = {
    name: 'tailor.rewrite',
    description: 'Rewrites resume bullets toward the job',
    activeVersion: 14,
    activeSince: on('2026-11-05'),
    draft: { version: 15, author: 'Marco K.' },
    versions: [
      version(15, 'draft', '2026-11-05', 'Marco K.', 0.91),
      version(14, 'active', '2026-10-29', 'Ana L.', 0.88),
      version(13, 'retired', '2026-10-14', 'Marco K.', 0.86),
      version(12, 'retired', '2026-09-30', 'Marco K.', 0.86),
      version(11, 'retired', '2026-09-12', 'Ehsan', 0.85),
      ...older,
    ],
    stage: {
      usedBy: 'Tailor flow · web, mobile',
      evalSet: 'tailor-120 · v3',
      threshold,
      runs7d: 18240,
      editors: 'Admin, Curator',
    },
    editor: editorFor('tailor.rewrite', TAILOR_SYSTEM),
    activeEditor: editorFor('tailor.rewrite', TAILOR_SYSTEM_V14),
    // "Autosaved 2 min ago": relative to now, so it never reads as hours old.
    autosavedAt: minutesAgo(2),
    eval: v15Eval,
    changeNote:
      'Tightened the no-invented-claims rule and limited keywords to ones the resume supports. Fixes over-claiming seen in v14 on senior roles.',
    sandbox: { resumes: RESUMES, jobs: JOBS, lastRun: BOARD_RUN },
  };
  const textOf = (v: number) =>
    v === 15 ? TAILOR_SYSTEM : v === 14 ? TAILOR_SYSTEM_V14 : TAILOR_SYSTEM_V13;
  const texts = new Map(
    detail.versions.map((v) => [v.version, editorFor('tailor.rewrite', textOf(v.version))]),
  );
  return { detail, texts, evals: new Map([[15, v15Eval]]) };
};

/** A prompt page for a stage the board doesn't draw: its versions and text, in the same shape. */
export function promptFixtureFor(stage: PromptStage): PromptFixture {
  if (stage.name === 'tailor.rewrite') return tailorRewriteFixture();
  const active = stage.activeVersion;
  const threshold = stage.threshold ?? 0.85;
  const text = editorFor(
    stage.name,
    `You are NextKin’s ${stage.name} stage.\n${stage.description}.\n\nNever invent facts the inputs don’t state.`,
  );
  const versions: PromptDetail['versions'] = [];
  if (stage.draft) {
    versions.push({
      version: stage.draft.version,
      status: 'draft',
      createdAt: stage.updatedAt,
      author: stage.updatedBy,
      evalScore: stage.draft.state === 'ready' ? (stage.lastEval?.score ?? null) : null,
    });
  }
  for (let v = active; v >= Math.max(1, active - 4); v -= 1) {
    versions.push({
      version: v,
      status: v === active ? 'active' : 'retired',
      createdAt: on(`2026-${String(Math.max(1, 10 - (active - v))).padStart(2, '0')}-15`),
      author: v % 2 ? 'Marco K.' : 'Ana L.',
      evalScore: v === active ? (stage.lastEval?.score ?? null) : 0.86,
    });
  }
  const evals = new Map<number, PromptEval>();
  if (stage.lastEval) {
    evals.set(stage.lastEval.version, {
      version: stage.lastEval.version,
      at: stage.lastEval.at,
      score: stage.lastEval.score,
      threshold,
      passed: stage.lastEval.passed,
      cases: 120,
      baseline: null,
      checks: [
        { label: 'Faithful to input', score: stage.lastEval.score, threshold },
        { label: 'Format valid', score: 1, threshold },
      ],
    });
  }
  const detail: PromptDetail = {
    name: stage.name,
    description: stage.description,
    activeVersion: active,
    activeSince: stage.lastEval?.at ?? stage.updatedAt,
    draft: stage.draft ? { version: stage.draft.version, author: stage.updatedBy } : null,
    versions,
    stage: {
      usedBy: 'Web, mobile',
      evalSet: `${stage.name.split('.')[0]}-120 · v2`,
      threshold,
      runs7d: 9400,
      editors: 'Admin, Curator',
    },
    editor: text,
    activeEditor: text,
    autosavedAt: null,
    eval: evals.get(stage.draft?.version ?? active) ?? null,
    changeNote: '',
    // Only tailor.rewrite has seeded samples: the other stages don't write bullets.
    sandbox: { resumes: [], jobs: [], lastRun: null },
  };
  return { detail, texts: new Map(versions.map((v) => [v.version, text])), evals };
}
