import {
  ContentNotServedError,
  EvalRequiredError,
  NotCertifiedError,
  type PromptDetail,
  type PromptEval,
  type PromptStage,
  type PromptVersionStatus,
  type ResumeTemplate,
  type RubricOverview,
  type TemplateLayout,
} from '../../models/adminContent';
import {
  evaluationWire,
  gateReportWire,
  messageReportWire,
  promptFiguresWire,
  promptsWire,
  rationaleWire,
  rubricWire,
  scopeReportWire,
  templateUsageWire,
  templatesWire,
  type EvaluationWire,
  type PromptVersionWire,
  type PromptWire,
  type TemplateWire,
} from '../../schemas/adminContent';
import type { AdminContentRepo } from '../adminContentRepo';
import { NotFoundError } from '../state';
import { createHttpKbMethods } from './adminContentKb';
import { createHttpSkillMethods } from './adminContentSkills';
import { ApiError, type HttpClient } from './client';

/**
 * `AdminContentRepo` over `/api/v1/admin/*` (P12-03, P12-04, P12-05): prompts, their versions and
 * evals (`services/admin/prompts.ts`), the technology KB (`adminContentKb.ts`), templates and the
 * rubric (`catalog.ts`), and the portal's own Content routes (`routes/adminContent.ts`): the skills
 * editor (`adminContentSkills.ts`), new templates and their usage, the rubric's rationale and the
 * prompts' thirty-day figures. What the server doesn't serve (the prompt sandbox, a stage's facts,
 * publishing a rubric) comes back `null` or throws `ContentNotServedError`; no fixture data reaches
 * a real staff session (`toreview.md` §171.9, §171.13).
 */

/** `POST /admin/prompts/{name}/versions` takes 1–20 paragraphs of 1–4,000 characters. */
const MAX_PARAGRAPHS = 20;
const MAX_PARAGRAPH = 4000;
/** An eval runs on the worker; it's polled this often, this many times (30 s), before giving up. */
const EVAL_POLL_MS = 1500;
const EVAL_POLLS = 20;

const STATUS: Record<string, PromptVersionStatus> = {
  draft: 'draft',
  staged: 'staged',
  active: 'active',
  // Activating a version archives the one it replaces, so an archived version was live once.
  archived: 'retired',
};

const isDraft = (v: PromptVersionWire) => v.status === 'draft' || v.status === 'staged';
const wasLive = (v: PromptVersionWire) => v.status === 'active' || v.status === 'archived';

/** The paragraphs a version stores (`{ system: string[] }`). */
const linesOf = (body: unknown): string[] => {
  const lines = (body as { system?: unknown } | null)?.system;
  return Array.isArray(lines) ? lines.map(String) : [];
};

/** The editor's text as the paragraphs a version stores: one per line, blank lines dropped. */
function paragraphsOf(text: string): string[] {
  const lines = text
    .split('\n')
    .map((line) => line.replace(/\r$/, ''))
    .filter((line) => line.trim());
  if (!lines.length) throw new Error('The system prompt can’t be empty.');
  if (lines.length > MAX_PARAGRAPHS) {
    throw new Error(
      `A system prompt holds at most ${MAX_PARAGRAPHS} paragraphs; this one has ${lines.length}.`,
    );
  }
  const long = lines.findIndex((line) => line.length > MAX_PARAGRAPH);
  if (long >= 0) throw new Error(`Paragraph ${long + 1} is over 4,000 characters.`);
  return lines;
}

const sameLines = (a: string[], b: string[]) =>
  a.length === b.length && a.every((line, i) => line === b[i]);

/**
 * The live version and the open draft. Every save is a new version on the server, so a draft is
 * open only while it's newer than every version that has been live; an older one was superseded
 * by a later save or publish.
 */
function versionsOf(p: PromptWire) {
  const active = p.versions.find((v) => v.status === 'active');
  const lived = Math.max(0, ...p.versions.filter(wasLive).map((v) => v.version));
  const draft = p.versions
    .filter((v) => isDraft(v) && v.version > lived)
    .sort((a, b) => b.version - a.version)[0];
  return { active, draft };
}

const toStage = (p: PromptWire): PromptStage => {
  const { active, draft } = versionsOf(p);
  const latest = [...p.versions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return {
    name: p.name,
    description: p.description ?? '',
    activeVersion: active?.version ?? 0,
    draft: draft
      ? { version: draft.version, state: draft.evaluated ? 'ready' : 'awaiting_eval' }
      : null,
    // The list says whether a version passed its eval, not its score.
    lastEval: null,
    threshold: null,
    costPerRunUsd: null,
    p95Seconds: null,
    updatedAt: latest?.createdAt ?? '',
    updatedBy: null,
  };
};

const editorOf = (v: PromptVersionWire | undefined) => ({
  system: linesOf(v?.body).join('\n'),
  // Only the system prompt is stored per version; the other tabs aren't served.
  user: '',
  schema: '',
  settings: '',
});

const toDetail = (p: PromptWire): PromptDetail => {
  const { active, draft } = versionsOf(p);
  return {
    name: p.name,
    description: p.description ?? '',
    activeVersion: active?.version ?? 0,
    // When a version went live isn't recorded; this is when it was written.
    activeSince: active?.createdAt ?? '',
    draft: draft ? { version: draft.version, author: null } : null,
    // The live version, the ones live before it and the open draft; superseded saves are left
    // out, so rolling back reaches the version that was live before.
    versions: p.versions
      .filter((v) => wasLive(v) || v === draft)
      .sort((a, b) => b.version - a.version)
      .map((v) => ({
        version: v.version,
        status: STATUS[v.status] ?? 'retired',
        createdAt: v.createdAt,
        author: null,
        evalScore: null,
      })),
    stage: null,
    editor: editorOf(draft ?? active),
    activeEditor: active ? editorOf(active) : null,
    autosavedAt: null,
    eval: null,
    changeNote: '',
    sandbox: null,
  };
};

/**
 * A finished eval as the portal shows it. A score is shown only where the server measured one: a
 * live run of the scope set (assistant.classify). The golden-set gate has no single score, and the
 * reference model only shows that a prompt runs end to end, so those verdicts are told in words.
 */
function toEval(version: number, run: EvaluationWire): PromptEval {
  if (run.status === 'running') {
    throw new Error(`v${version}’s eval is still running. Check back in a minute.`);
  }
  const scope = scopeReportWire.safeParse(run.report);
  const finished = run.status === 'passed' || run.status === 'failed';
  if (finished && run.mode === 'live' && scope.success) {
    return {
      version,
      at: run.finishedAt ?? run.createdAt ?? new Date().toISOString(),
      score: scope.data.accuracy,
      threshold: scope.data.bar,
      passed: run.status === 'passed',
      cases: scope.data.total,
      baseline: null,
      checks: [],
    };
  }
  const reference =
    run.mode === 'reference'
      ? ' on the reference model, which checks that it runs end to end, not how well it does'
      : '';
  if (run.status === 'passed') {
    throw new Error(`v${version} passed its eval${reference}. There’s no single score to show.`);
  }
  const gate = gateReportWire.safeParse(run.report);
  const message = messageReportWire.safeParse(run.report);
  if (run.status === 'failed') {
    const why =
      gate.success && gate.data.failures.length
        ? gate.data.failures.join('; ')
        : scope.success
          ? `${scope.data.correct} of ${scope.data.total} cases right, below the ${Math.round(scope.data.bar * 100)}% bar`
          : message.success
            ? message.data.message
            : 'no reason was recorded';
    throw new Error(`v${version} didn’t pass its eval${reference}: ${why}`);
  }
  // `unsupported`: no eval covers this template, so it can't be published.
  throw new Error(message.success ? message.data.message : `v${version} couldn’t be evaluated.`);
}

const isConflict = (error: unknown, reason: string) =>
  error instanceof ApiError &&
  error.code === 'CONFLICT' &&
  (error.details as { reason?: unknown } | null)?.reason === reason;

/** The renderer's styles use these slugs (`export/latex/styles.ts`); others get the plain sketch. */
const LAYOUTS: readonly string[] = ['jake', 'modern', 'elegant', 'compact', 'executive', 'classic'];

/** A copy draws as the template it is based on, which is also how it renders until its own ships. */
const layoutOf = (slug: string, basedOn: string | null | undefined): TemplateLayout => {
  const drawn = LAYOUTS.includes(slug) ? slug : (basedOn ?? '');
  return LAYOUTS.includes(drawn) ? (drawn as TemplateLayout) : 'jake';
};

type TemplateUsage = { inUse: number; basedOn: string | null };

const toTemplate = (t: TemplateWire, usage?: TemplateUsage): ResumeTemplate => ({
  slug: t.slug,
  name: t.name,
  layout: layoutOf(t.slug, usage?.basedOn ?? (t.assets as { basedOn?: string } | undefined)?.basedOn),
  // Certified means it passed the parse-back check (Q-06) that publishing needs; `ats_safe` is
  // only the design's claim.
  atsSafe: t.certified_at != null,
  status: t.status === 'published' || t.status === 'archived' ? t.status : 'draft',
  // Revisions aren't kept; usage is live resumes using the template.
  rev: 0,
  inUse: usage?.inUse ?? 0,
  editedAt: t.updated_at,
  editedBy: '—',
  archivedAt: t.status === 'archived' ? t.updated_at : null,
});

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Oct 03, 2026": the rubric board's padded day, in UTC. */
const paddedDay = (iso: string) => {
  const date = new Date(iso);
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${MONTHS[date.getUTCMonth()] ?? ''} ${day}, ${date.getUTCFullYear()}`;
};

export function createHttpAdminContentRepo(http: HttpClient): AdminContentRepo {
  const prompts = async () => promptsWire.parse(await http.request('/admin/prompts')).data;
  const promptNamed = async (name: string) => {
    const found = (await prompts()).find((p) => p.name === name);
    if (!found) throw new NotFoundError('Prompt', name);
    return found;
  };
  const versionOf = async (name: string, version: number) => {
    const prompt = await promptNamed(name);
    const target = prompt.versions.find((v) => v.version === version);
    if (!target) throw new NotFoundError('PromptVersion', `${name} v${version}`);
    return { prompt, target, path: `/admin/prompts/versions/${encodeURIComponent(target.id)}` };
  };
  const draftVersion = (name: string, system: string[]) =>
    http.request(`/admin/prompts/${encodeURIComponent(name)}/versions`, { body: { system } });
  const listTemplates = async () => {
    const [list, usage] = await Promise.all([
      http.request('/admin/templates').then((raw) => templatesWire.parse(raw).data),
      http.request('/admin/templates/usage').then((raw) => templateUsageWire.parse(raw).data),
    ]);
    const bySlug = new Map(usage.map((u) => [u.slug, u]));
    return list.map((t) => toTemplate(t, bySlug.get(t.slug)));
  };
  const notServed = (what: string) => async (): Promise<never> => {
    throw new ContentNotServedError(what);
  };

  const rubric = async (): Promise<RubricOverview> => {
    const [rows, edited] = await Promise.all([
      http.request('/admin/rubric').then((raw) => rubricWire.parse(raw).data),
      http.request('/admin/rubric/rationale').then((raw) => rationaleWire.parse(raw).data),
    ]);
    const current = rows.find((r) => r.is_current);
    return {
      versions: rows.map((r) => ({
        version: r.version,
        // The server keeps one current version and no drafts.
        status: r.is_current ? 'active' : 'retired',
        author: '—',
        dateLabel: paddedDay(r.created_at),
        // When a version became current isn't recorded.
        activeSince: null,
        criteria: Object.entries(r.weights).map(([key, bps]) => ({
          key,
          // Criteria come keyed by id, with no labels or descriptions.
          label: key,
          description: '',
          // Basis points of the total (the engines' `weightBps`): 4000 is 40%.
          weight: bps / 100,
          evidence: '',
        })),
      })),
      // The checklist and the dry run belong to a draft, and there are none to publish.
      checklist: [],
      rationale: current?.rationale
        ? {
            paragraphs: current.rationale
              .split(/\n\s*\n/)
              .map((p) => p.trim())
              .filter(Boolean),
            // Who last edited the prose, where a staff member has; the seeded text has no editor.
            byline:
              edited?.updatedBy && edited.updatedAt
                ? `Edited by ${edited.updatedBy} · ${paddedDay(edited.updatedAt)}`
                : '',
            evidence: current.evidence ? [{ title: current.evidence, detail: '' }] : [],
          }
        : null,
      impact: null,
    };
  };

  return {
    listPrompts: async () => {
      const [list, figures] = await Promise.all([
        prompts(),
        http.request('/admin/prompts/figures').then((raw) => promptFiguresWire.parse(raw)),
      ]);
      const { current, previous } = figures;
      return {
        stages: list.map(toStage),
        evalPassRate:
          current.evalPassRate === null
            ? null
            : {
                rate: current.evalPassRate,
                // The change in points from the thirty days before, where those measured anything.
                deltaPercent:
                  previous.evalPassRate === null
                    ? null
                    : Math.round((current.evalPassRate - previous.evalPassRate) * 1000) / 10,
              },
        costPerResume:
          current.costPerResumeUsd === null
            ? null
            : {
                usd: current.costPerResumeUsd,
                previousUsd: previous.costPerResumeUsd,
                previousLabel: previous.costPerResumeUsd === null ? null : 'the 30 days before',
              },
      };
    },
    getPrompt: async (name) => toDetail(await promptNamed(name)),
    createPromptDraft: async (name) => {
      const prompt = await promptNamed(name);
      const { active, draft } = versionsOf(prompt);
      if (draft) return toDetail(prompt);
      const system = linesOf(active?.body);
      if (!system.length) throw new Error(`${name} has no live version to start a draft from.`);
      await draftVersion(name, system);
      return toDetail(await promptNamed(name));
    },
    savePromptDraft: async (name, edit) => {
      // A version is immutable on the server, so saving the system prompt makes a new draft. The
      // other tabs and the change note aren't stored per version yet.
      if (!('tab' in edit) || edit.tab !== 'system') {
        throw new ContentNotServedError('saving this part of a prompt');
      }
      const system = paragraphsOf(edit.text);
      const prompt = await promptNamed(name);
      const { active, draft } = versionsOf(prompt);
      // Only blank lines changed (a version keeps paragraphs, not blank lines): nothing to save.
      if (sameLines(system, linesOf((draft ?? active)?.body))) return toDetail(prompt);
      await draftVersion(name, system);
      return toDetail(await promptNamed(name));
    },
    evaluatePrompt: async (name, version) => {
      const { path } = await versionOf(name, version);
      const started = evaluationWire.parse(
        await http.request(`${path}/evaluate`, { method: 'POST' }),
      );
      let run = started;
      for (let polls = 0; run.status === 'running' && polls < EVAL_POLLS; polls += 1) {
        await new Promise((resolve) => setTimeout(resolve, EVAL_POLL_MS));
        run = evaluationWire.parse(
          await http.request(`/admin/prompts/evaluations/${encodeURIComponent(started.id)}`),
        );
      }
      return toEval(version, run);
    },
    publishPrompt: async (name, version) => {
      const { target, path } = await versionOf(name, version);
      // Refused before anything is staged: a draft goes live only with a passing eval of itself.
      if (isDraft(target) && !target.evaluated) throw new EvalRequiredError(version);
      try {
        if (target.status === 'draft') await http.request(`${path}/stage`, { method: 'POST' });
        await http.request(`${path}/activate`, { method: 'POST' });
      } catch (error) {
        if (isConflict(error, 'eval_required')) throw new EvalRequiredError(version);
        throw error;
      }
      return toDetail(await promptNamed(name));
    },
    rollbackPrompt: async (name, version) => {
      const { prompt, target, path } = await versionOf(name, version);
      if (target.status === 'active') return toDetail(prompt);
      // Rolling back re-activates a version that was live, which passed when it went live.
      if (target.status !== 'archived') {
        throw new Error(`v${version} was never live, so there’s nothing to roll back to.`);
      }
      await http.request(`${path}/activate`, { method: 'POST' });
      return toDetail(await promptNamed(name));
    },
    runSandbox: async () => null,

    ...createHttpKbMethods(http),

    ...createHttpSkillMethods(http),

    listTemplates,
    setTemplateStatus: async (slug, status) => {
      try {
        await http.request(`/admin/templates/${encodeURIComponent(slug)}/status`, {
          body: { status },
        });
      } catch (error) {
        if (!isConflict(error, 'not_certified')) throw error;
        const named = (await listTemplates().catch(() => [])).find((t) => t.slug === slug);
        throw new NotCertifiedError(named?.name ?? slug);
      }
      const found = (await listTemplates()).find((t) => t.slug === slug);
      if (!found) throw new NotFoundError('Template', slug);
      return found;
    },
    createTemplate: async ({ name, basedOn }) => {
      const created = templatesWire.shape.data.element.parse(
        await http.request('/admin/templates', { body: { name, basedOn } }),
      );
      // A new copy is a draft no resume uses yet.
      return toTemplate(created, { inUse: 0, basedOn });
    },

    rubric,
    // The weights and bands are the engines' code (`rubric-2`): a new version ships with an engines
    // release, so there is never a draft here to publish.
    publishRubric: notServed('publishing a rubric (a new version ships with an engines release)'),
    saveRationale: async (paragraphs) => {
      const versions = rubricWire.parse(await http.request('/admin/rubric')).data;
      const current = versions.find((r) => r.is_current);
      if (!current) throw new NotFoundError('RubricVersion', 'current');
      await http.request('/admin/rubric/rationale', {
        method: 'PUT',
        body: { version: `v${current.version}`, paragraphs },
      });
      return rubric();
    },
  };
}
