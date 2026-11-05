import { simulate } from '../mock/delay';
import {
  evalChecksFor,
  promptFixtureFor,
  promptStagesFixture,
  promptsStatsFixture,
  sandboxCasesFixture,
  type PromptFixture,
} from '../mock/fixtures/adminPrompts';
import {
  EvalRequiredError,
  type PromptDetail,
  type PromptEditorTab,
  type PromptEval,
  type PromptsOverview,
  type SandboxRun,
} from '../models/adminContent';

import { recordAdminAudit } from './adminAuditLog';
import { onAdminMockReset } from './adminMockReset';
import { clone, NotFoundError } from './state';

/** The AI prompts part of the admin Content repo (Figma 406:662, 407:3141). */
export interface AdminPromptsRepo {
  listPrompts(): Promise<PromptsOverview>;
  getPrompt(name: string): Promise<PromptDetail>;
  /** Starts a draft from the active version, or returns the draft already open. */
  createPromptDraft(name: string): Promise<PromptDetail>;
  /** Refused without an open draft: the live text is never edited in place. */
  savePromptDraft(
    name: string,
    edit: { tab: PromptEditorTab; text: string } | { note: string },
  ): Promise<PromptDetail>;
  evaluatePrompt(name: string, version: number): Promise<PromptEval>;
  /** Makes a version live. Refused (`EvalRequiredError`) without a passing eval. */
  publishPrompt(name: string, version: number): Promise<PromptDetail>;
  rollbackPrompt(name: string, version: number): Promise<PromptDetail>;
  /** `null` where the source has no sandbox. */
  runSandbox(name: string, sample: { resumeId: string; jobId: string }): Promise<SandboxRun | null>;
}

const STAFF = 'Ehsan';
const now = () => new Date().toISOString();

/** A small stable hash, so the canned eval of a given text always comes out the same. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * The mock's eval: canned, but derived from the version's text, so a changed prompt can score
 * differently and an emptied one fails. Each check lands between 0.86 and 1.00 for a prompt with
 * text, and at 0 for one without (`toreview.md` §171.9).
 */
function cannedEval(
  name: string,
  version: number,
  text: Record<PromptEditorTab, string>,
  threshold: number,
  baseline: PromptEval['baseline'],
): PromptEval {
  const body = `${text.system}\n${text.user}`;
  const blank = !text.system.trim();
  const checks = evalChecksFor(name).map((label) => ({
    label,
    score: blank ? 0 : Number((0.86 + (hash(`${label}\n${body}`) % 15) / 100).toFixed(2)),
    threshold,
  }));
  const score = Number((checks.reduce((sum, c) => sum + c.score, 0) / checks.length).toFixed(2));
  return {
    version,
    at: now(),
    score,
    threshold,
    passed: score >= threshold,
    cases: 120,
    baseline,
    checks,
  };
}

export function createMockPromptsRepo(): AdminPromptsRepo {
  let stages = clone(promptStagesFixture);
  let prompts = new Map<string, PromptFixture>();
  onAdminMockReset(() => {
    stages = clone(promptStagesFixture);
    prompts = new Map();
  });

  const stageOf = (name: string) => {
    const stage = stages.find((s) => s.name === name);
    if (!stage) throw new NotFoundError('Prompt', name);
    return stage;
  };
  const promptOf = (name: string) => {
    let found = prompts.get(name);
    if (!found) {
      found = promptFixtureFor(stageOf(name));
      found = { detail: clone(found.detail), texts: found.texts, evals: found.evals };
      prompts.set(name, found);
    }
    return found;
  };
  const touch = (name: string) => {
    const stage = stageOf(name);
    stage.updatedAt = now();
    stage.updatedBy = STAFF;
  };
  /**
   * Points the page at the version it shows (the draft, else the live one): that version's text,
   * the live text for the diff, and that version's own eval or none.
   */
  const show = (found: PromptFixture) => {
    const { detail, texts, evals } = found;
    const shown = detail.draft?.version ?? detail.activeVersion;
    const live = texts.get(detail.activeVersion);
    detail.editor = clone(texts.get(shown) ?? live ?? detail.editor);
    detail.activeEditor = live ? clone(live) : null;
    detail.eval = clone(evals.get(shown) ?? null);
  };

  return {
    listPrompts: () =>
      simulate<PromptsOverview>(() => ({ stages: clone(stages), ...clone(promptsStatsFixture) }), {
        empty: () => ({ stages: [], evalPassRate: null, costPerResume: null }),
      }),

    getPrompt: (name) => simulate(() => clone(promptOf(name).detail)),

    createPromptDraft: (name) =>
      simulate(() => {
        const found = promptOf(name);
        const { detail, texts } = found;
        if (!detail.draft) {
          const version = Math.max(...detail.versions.map((v) => v.version)) + 1;
          detail.draft = { version, author: STAFF };
          detail.versions.unshift({
            version,
            status: 'draft',
            createdAt: now(),
            author: STAFF,
            evalScore: null,
          });
          // A new draft starts from the live text, with its own (empty) change note.
          texts.set(version, clone(texts.get(detail.activeVersion) ?? detail.editor));
          detail.changeNote = '';
          detail.autosavedAt = now();
          show(found);
          stageOf(name).draft = { version, state: 'awaiting_eval' };
          touch(name);
          recordAdminAudit('Drafted prompt', 'prompt', `${name} v${version}`);
        }
        return clone(detail);
      }),

    savePromptDraft: (name, edit) =>
      simulate(() => {
        const found = promptOf(name);
        const { detail, texts, evals } = found;
        const draft = detail.draft;
        if (!draft) throw new Error('Start a draft before editing the prompt.');
        if ('note' in edit) {
          detail.changeNote = edit.note;
        } else {
          const text = clone(texts.get(draft.version) ?? detail.editor);
          text[edit.tab] = edit.text;
          texts.set(draft.version, text);
          // An edited draft needs a fresh eval before it can be published.
          evals.delete(draft.version);
          const row = detail.versions.find((v) => v.version === draft.version);
          if (row) row.evalScore = null;
          stageOf(name).draft = { version: draft.version, state: 'awaiting_eval' };
          show(found);
        }
        detail.autosavedAt = now();
        touch(name);
        return clone(detail);
      }),

    evaluatePrompt: (name, version) =>
      simulate(
        () => {
          const found = promptOf(name);
          const { detail, texts, evals } = found;
          const stage = stageOf(name);
          const text = texts.get(version);
          if (!text) throw new NotFoundError('PromptVersion', `${name} v${version}`);
          // The live version's own score on the same set, when it has one.
          const live = detail.versions.find((v) => v.version === detail.activeVersion);
          const baseline =
            version !== detail.activeVersion && live?.evalScore != null
              ? { version: live.version, score: live.evalScore }
              : null;
          // A version whose text hasn't changed since its last eval scores the same again.
          const kept = evals.get(version);
          const result = kept
            ? { ...kept, at: now() }
            : cannedEval(name, version, text, stage.threshold ?? 0.85, baseline);
          evals.set(version, result);
          const row = detail.versions.find((v) => v.version === version);
          if (row) row.evalScore = result.score;
          stage.lastEval = { score: result.score, version, at: result.at, passed: result.passed };
          recordAdminAudit('Evaluated prompt', 'prompt', `${name} v${version}`);
          if (stage.draft?.version === version) {
            stage.draft = { version, state: result.passed ? 'ready' : 'awaiting_eval' };
          }
          show(found);
          touch(name);
          return clone(result);
        },
        { minMs: 900, maxMs: 1400 },
      ),

    publishPrompt: (name, version) =>
      simulate(() => {
        const found = promptOf(name);
        const { detail, evals } = found;
        const result = evals.get(version);
        if (!result?.passed) throw new EvalRequiredError(version);
        for (const v of detail.versions) {
          if (v.status === 'active') v.status = 'retired';
          if (v.version === version) v.status = 'active';
        }
        detail.activeVersion = version;
        detail.activeSince = now();
        if (detail.draft?.version === version) detail.draft = null;
        show(found);
        const stage = stageOf(name);
        stage.activeVersion = version;
        stage.draft = null;
        touch(name);
        recordAdminAudit('Published prompt', 'prompt', `${name} v${version}`);
        return clone(detail);
      }),

    rollbackPrompt: (name, version) =>
      simulate(() => {
        const found = promptOf(name);
        const { detail } = found;
        const target = detail.versions.find((v) => v.version === version);
        if (!target || target.status === 'draft') {
          throw new NotFoundError('PromptVersion', `${name} v${version}`);
        }
        for (const v of detail.versions) if (v.status === 'active') v.status = 'retired';
        target.status = 'active';
        detail.activeVersion = version;
        detail.activeSince = now();
        show(found);
        stageOf(name).activeVersion = version;
        touch(name);
        recordAdminAudit('Rolled back prompt', 'prompt', `${name} v${version}`);
        return clone(detail);
      }),

    runSandbox: (name, sample) =>
      simulate(
        () => {
          const { detail } = promptOf(name);
          const canned = sandboxCasesFixture.find(
            (c) => c.resumeId === sample.resumeId && c.jobId === sample.jobId,
          );
          if (!detail.sandbox || !canned) {
            throw new Error(
              'The mock has a canned run only for each seeded resume with the job it was seeded for.',
            );
          }
          const version = detail.draft?.version ?? detail.activeVersion;
          const run: SandboxRun = { ...clone(canned), ranAt: now(), version };
          detail.sandbox.lastRun = run;
          return clone(run);
        },
        { minMs: 900, maxMs: 1400 },
      ),
  };
}
