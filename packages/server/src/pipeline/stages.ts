import { GENERATION_KIND_LABEL, type GenerationKind } from '@nextkin/shared/models/generation';
import type { AiGateway, CallMeta } from '../ai/gateway';
import type { LatexCompiler } from '../export/latex/compile';
import type { StageInput } from '../ai/pii';
import type { Database } from '../db/database';
import type { PromptVersion } from '../services/prompts';

/**
 * Pipeline definitions (ImBackendImplementationPlan P6-04, P6-15). A pipeline is an ordered list of
 * stages; each stage maps to the status the client shows while it runs. Stages must be idempotent:
 * a redelivered message re-runs the first incomplete stage, so a stage may run more than once and
 * only its committed output counts.
 *
 * P6 ships the hello-world pipeline for every kind: one model call, a deterministic check, and a
 * scoring placeholder. P9 replaces it per kind with the real stages (JD extraction, tailoring,
 * validation, the claim ledger, scoring) on this same runner.
 */

export interface StageContext {
  generationId: string;
  userId: string;
  kind: GenerationKind;
  /** The run's PII-free input (P6-12): never the profile's contact fields. */
  input: StageInput<{ title?: string }>;
  /**
   * The run's stored input (P9): what the client asked for, the PII-free facts snapshot taken at
   * start, and `asOf`. Stages parse what they read; none of it holds a contact field (G5).
   */
  run: Record<string, unknown>;
  /** Outputs of the stages already completed. */
  outputs: Record<string, unknown>;
  prompt: PromptVersion;
  /** Every prompt the pipeline declared, pinned at the run's first attempt. */
  prompts: Record<string, PromptVersion>;
  /** Stages that load or persist read and write as the run's owner (withUser). */
  db: Database;
  correlationId: string | null;
  gateway: AiGateway;
  /** The sealed LaTeX compiler, when this worker has one: a tailored run fits compiled pages (§111.6). */
  latex?: LatexCompiler;
}

export interface StageResult {
  output: unknown;
  /** The model call behind it, recorded on the generation's stage log (failover included). */
  meta?: CallMeta;
}

export interface StageDef {
  name: string;
  status: 'generating' | 'validating' | 'scoring';
  run(ctx: StageContext): Promise<StageResult>;
}

export interface PipelineDef {
  /** The primary prompt template (its version is pinned on the run's column). */
  promptTemplate: string;
  /** Every template the stages read, the primary included; all are pinned at the first attempt. */
  prompts?: readonly string[];
  stages: StageDef[];
}

const MAX_SUMMARY = 400;

export const helloPipeline: PipelineDef = {
  promptTemplate: 'hello.summary',
  stages: [
    {
      name: 'draft',
      status: 'generating',
      async run(ctx) {
        const { text, meta } = await ctx.gateway.generate({
          stage: 'hello',
          system: ctx.prompt.body.system.map((text) => ({ text })),
          input: { document: GENERATION_KIND_LABEL[ctx.kind], role: ctx.input.title ?? null },
          context: { userId: ctx.userId, generationId: ctx.generationId, correlationId: ctx.correlationId, promptVersionId: ctx.prompt.id },
        });
        return { output: { summary: text.trim().slice(0, MAX_SUMMARY) }, meta };
      },
    },
    {
      name: 'check',
      status: 'validating',
      // Deterministic: the model proposes, code decides (G14).
      async run(ctx) {
        const summary = (ctx.outputs.draft as { summary?: string } | undefined)?.summary ?? '';
        if (!summary) throw new StageError('empty_output', 'The draft came back empty.');
        return { output: { words: summary.split(/\s+/).filter(Boolean).length } };
      },
    },
    {
      name: 'score',
      status: 'scoring',
      // A placeholder until the rubric engine (P8): no number is invented (G17).
      async run() {
        return { output: { score: null } };
      },
    },
  ],
};

/**
 * The kinds a run can be: the apps' generation kinds, plus `section` (P10-02), the regeneration of
 * one section of an existing resume. A section run is internal: the apps' generation list never
 * shows it, and its progress is read through the resume it belongs to.
 */
export type RunKind = GenerationKind | 'section';

/**
 * Every kind on hello-world: the P6 tests' pipelines, which exercise the runner (checkpoints, crash
 * injection, SSE) without the real stages. Production runs `PIPELINES` from `./pipelines`.
 */
export const HELLO_PIPELINES: Record<RunKind, PipelineDef> = {
  section: helloPipeline,
  resume: helloPipeline,
  cover_letter: helloPipeline,
  zero_resume: helloPipeline,
  ats_check: helloPipeline,
  interview: helloPipeline,
};

/** A stage failure that retrying cannot fix. */
export class StageError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'StageError';
  }
}
