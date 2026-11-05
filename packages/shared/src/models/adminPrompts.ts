/**
 * The admin portal's AI prompts (Figma 406:662, 407:3141): pipeline stages, their versions, evals
 * and the sandbox. Re-exported from `adminContent`, the Content area's models.
 */

/** A stage's draft, when it has one: passed its eval and ready, or still waiting for one. */
export type PromptDraft = { version: number; state: 'ready' | 'awaiting_eval' };

export type PromptEvalSummary = { score: number; version: number; at: string; passed: boolean };

/** One pipeline stage's prompt, as the AI prompts table lists it (Figma 406:662). */
export type PromptStage = {
  name: string;
  description: string;
  activeVersion: number;
  draft: PromptDraft | null;
  lastEval: PromptEvalSummary | null;
  /** `null` where the source doesn't report the eval threshold. */
  threshold: number | null;
  costPerRunUsd: number | null;
  p95Seconds: number | null;
  updatedAt: string;
  /** `null` where the source records no author. */
  updatedBy: string | null;
};

export type PromptsOverview = {
  stages: PromptStage[];
  /** Figures the stages alone can't give; `null` where the source doesn't report them. */
  /** `deltaPercent` is the change in points from the window before; `null` where it measured nothing. */
  evalPassRate: { rate: number; deltaPercent: number | null } | null;
  /** The previous window's figure; both `null` where it measured nothing. */
  costPerResume: { usd: number; previousUsd: number | null; previousLabel: string | null } | null;
};

export type PromptVersionStatus = 'draft' | 'staged' | 'active' | 'retired';

export type PromptVersion = {
  version: number;
  status: PromptVersionStatus;
  createdAt: string;
  author: string | null;
  /** Its eval score, if it has been evaluated. */
  evalScore: number | null;
};

export type PromptEditorTab = 'system' | 'user' | 'schema' | 'settings';

export type PromptEvalCheck = { label: string; score: number; threshold: number };

export type PromptEval = {
  version: number;
  at: string;
  score: number;
  threshold: number;
  passed: boolean;
  cases: number;
  /** The active version's score on the same set, for comparison. */
  baseline: { version: number; score: number } | null;
  checks: PromptEvalCheck[];
};

export type SandboxBullet = { before: string; after: string; keywords: string[] };

export type SandboxRun = {
  ranAt: string;
  version: number;
  /** The seeded samples it ran on. */
  resumeId: string;
  jobId: string;
  bullets: SandboxBullet[];
  /** How many bullets the run produced; the preview shows a few. */
  total: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencySeconds: number;
};

export type SandboxSample = { id: string; label: string };

/** One prompt's page (Figma 407:3141). */
export type PromptDetail = {
  name: string;
  description: string;
  activeVersion: number;
  activeSince: string;
  draft: { version: number; author: string | null } | null;
  versions: PromptVersion[];
  /** The stage's facts; `null` where the source doesn't serve them. */
  stage: {
    usedBy: string;
    evalSet: string;
    threshold: number;
    runs7d: number;
    editors: string;
  } | null;
  /** The draft's text per editor tab (the active version's when there is no draft). */
  editor: Record<PromptEditorTab, string>;
  /** The active version's text, for the diff; `null` where the source doesn't serve it. */
  activeEditor: Record<PromptEditorTab, string> | null;
  autosavedAt: string | null;
  eval: PromptEval | null;
  changeNote: string;
  /** `null` where the source has no sandbox (it isn't served yet). */
  sandbox: { resumes: SandboxSample[]; jobs: SandboxSample[]; lastRun: SandboxRun | null } | null;
};

/** Publishing a version whose eval hasn't passed is refused (V2 §7.17, P12-03). */
export class EvalRequiredError extends Error {
  constructor(version: number) {
    super(`v${version} needs a passing eval before it can be published.`);
    this.name = 'EvalRequiredError';
  }
}
