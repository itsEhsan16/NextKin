import type { Generation, GenerationKind, GenerationStatus } from '@nextkin/shared/models/generation';
import type { TailorRun } from '@nextkin/shared/models/tailor';
import type { Selectable } from 'kysely';
import type { Generations } from '../db/types.generated';
import type { TailorRunInput } from './stages/tailorMerge';

/**
 * The client's `Generation` from a generations row (P6-13): what every SSE event carries in `data`
 * and what GET /generations/:id answers. Progress is the share of the pipeline's stages that are
 * done, so it only ever moves forward and reaches 1 exactly at `ready`.
 */
export type GenerationRow = Selectable<Generations>;

export interface Checkpoint {
  completed: string[];
  outputs: Record<string, unknown>;
}

export const readCheckpoint = (row: Pick<GenerationRow, 'checkpoint'>): Checkpoint => {
  const raw = (row.checkpoint ?? {}) as Partial<Checkpoint>;
  return { completed: Array.isArray(raw.completed) ? raw.completed : [], outputs: raw.outputs && typeof raw.outputs === 'object' ? raw.outputs : {} };
};

const iso = (value: Date | string | null) => (value ? new Date(value).toISOString() : new Date(0).toISOString());

/** What a tailored run was asked (pinned at start, `services/tailorStart.ts`) and, once saved, did. */
function tailorOf(input: { tailor?: TailorRunInput }, persisted: Partial<TailorRun> | undefined): TailorRun | undefined {
  const asked = input.tailor;
  if (!asked) return undefined;
  return {
    sourceResumeId: asked.baseResumeId,
    baselineScore: asked.baselineScore,
    added: asked.added,
    skipped: asked.skipped,
    fixes: asked.fixes,
    experience: asked.experience,
    ...(asked.sourcePages != null ? { sourcePages: asked.sourcePages } : {}),
    ...(asked.confirmed?.length ? { confirmed: asked.confirmed } : {}),
    ...(asked.figures?.length ? { figures: asked.figures } : {}),
    ...(asked.projected !== undefined ? { projected: asked.projected } : {}),
    ...(asked.baselineJobMatch ? { baselineJobMatch: asked.baselineJobMatch } : {}),
    ...(persisted ?? {}),
  };
}

export function toSnapshot(row: GenerationRow, stageCount: number): Generation {
  const input = (row.input ?? {}) as { title?: string; jdId?: string; jobId?: string; sourceResumeId?: string; tone?: Generation['tone']; origin?: 'build'; build?: Generation['build']; tailor?: TailorRunInput };
  const checkpoint = readCheckpoint(row);
  const done = checkpoint.completed.length;
  // An ATS check's result (P9) and a tailored run's (toreview §110.3), written by the persist stage.
  const persisted = checkpoint.outputs.persist as { atsCheck?: Generation['atsCheck']; tailor?: Partial<TailorRun> } | undefined;
  const atsCheck = persisted?.atsCheck;
  const tailor = tailorOf(input, persisted?.tailor);
  const status = row.status as GenerationStatus;
  const progress = status === 'ready' ? 1 : stageCount === 0 ? 0 : Math.min(0.99, Math.round((done / stageCount) * 100) / 100);
  return {
    id: row.id,
    kind: row.kind as GenerationKind,
    status,
    progress,
    startedAt: iso(row.started_at ?? row.created_at),
    updatedAt: iso(row.updated_at),
    ...(row.error_message ? { error: row.error_message } : {}),
    ...(row.resume_id ? { resumeId: row.resume_id } : {}),
    ...(input.jdId ? { jdId: input.jdId } : {}),
    ...(input.jobId ? { jobId: input.jobId } : {}),
    ...(input.title ? { title: input.title } : {}),
    ...(input.tone ? { tone: input.tone } : {}),
    ...(input.sourceResumeId ? { sourceResumeId: input.sourceResumeId } : {}),
    ...(input.origin ? { origin: input.origin } : {}),
    ...(input.build ? { build: input.build } : {}),
    ...(atsCheck ? { atsCheck } : {}),
    ...(tailor ? { tailor } : {}),
  };
}
