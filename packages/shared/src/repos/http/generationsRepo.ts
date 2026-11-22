import { focusManager } from '@tanstack/react-query';

import type { Generation, GenerationInput } from '../../models/generation';
import type { TailorFix, TailorRun } from '../../models/tailor';
import { generationResultSchema, generationSchema, type GenerationRequest, type Tailoring } from '../../schemas/generation';
import { jdDraftSchema } from '../../schemas/jd';
import type { AdoptedDocument } from '../adopt';
import type { GenerationsRepo } from '../types';
import { NotFoundError } from '../state';
import { ApiError, type HttpClient } from './client';
import { isServerId } from './jdRepo';
import { fetchDocument } from './serverDocs';

/**
 * `GenerationsRepo` over HTTP (ImBackendImplementationPlan P9-08, P10-13). The server runs a resume
 * built from the profile (Build Resume), a Zero Resume draft, and, since the library is served
 * (P10), a cover letter or an ATS check of a server document, (P11) a run from a listing the
 * server serves and an interview set, and (toreview §110.3) a tailored run of a server resume.
 * A JD run that names a base resume without tailoring it (mobile's JD review), and runs from
 * documents or listings only the mock has, stay on the mock and are listed below; when one of
 * those starts from a server document, the document is copied into the mock library first so the
 * mock run can read it. A run keeps the id space it started in.
 *
 * Progress is polled (`GET /generations/:id`); the SSE route exists and the shared reader is proved
 * against it (P6-14), but the polling fallback is the one Expo Go is known to run. When a server run
 * finishes, its document is copied into the app's library (`adopt`) before the final event, so the
 * ready screen opens it at once.
 */
export const GENERATIONS_FALLBACKS = ['start:resume-from-library', 'start:from-mock-listing', 'start:from-mock-document'] as const;

const parse = (data: unknown): Generation => generationSchema.parse(data) as Generation;

/**
 * Whether the server can run this input: every id it names is a server one (a listing the server
 * serves resolves to its JD first, P11-11), and a resume run either builds from the profile or
 * tailors a server resume.
 */
export function servedOnServer(input: GenerationInput): boolean {
  const listingOk = input.jobId === undefined || isServerId(input.jobId);
  const jdOk = input.jdId === undefined || isServerId(input.jdId);
  if (!listingOk || !jdOk) return false;
  if (input.kind === 'zero_resume') return true;
  // An interview set: standalone (a role title alone), or about a server document (P11-08).
  if (input.kind === 'interview') return input.sourceResumeId === undefined || isServerId(input.sourceResumeId);
  if (input.kind === 'cover_letter' || input.kind === 'ats_check') return !!input.sourceResumeId && isServerId(input.sourceResumeId);
  if (input.kind !== 'resume') return false;
  if (input.tailor) return !!input.baseResumeId && isServerId(input.baseResumeId) && !!(input.jdId ?? input.jobId);
  return !input.baseResumeId;
}

const ALL_FIXES: TailorFix[] = ['headline', 'summary', 'skills', 'experience', 'projects', 'length'];

/**
 * A tailor run as the server is asked for it (toreview §110.3). Mobile's runs leave the parts and
 * the depth unset, which means all of them. Only the ticks travel: the server measures the baseline
 * and works out what was skipped itself, so a client cannot claim a score.
 */
export const toTailoring = (run: TailorRun): Tailoring => ({
  fixes: run.fixes ?? ALL_FIXES,
  experience: run.experience ?? 'full',
  keywords: run.added,
  ...(run.confirmed?.length ? { confirmed: run.confirmed } : {}),
  ...(run.figures?.length ? { figures: run.figures } : {}),
  ...(run.header?.length ? { header: run.header } : {}),
});

const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r % 4) + 8).toString(16);
  });

export function createHttpGenerationsRepo(
  http: HttpClient,
  mock: GenerationsRepo,
  adopt: (doc: AdoptedDocument) => void,
  options: { everyMs?: number; strict?: boolean } = {},
): GenerationsRepo {
  const adopted = new Set<string>();
  // A start that got no answer (a timeout, a dropped connection) may have started on the server.
  // Pressing again with the same choices reuses its idempotency key, so the server hands back that
  // run instead of making, and charging for, a second one.
  const unanswered = new Map<string, { key: string; at: number }>();
  const finish = async (generation: Generation) => {
    if (generation.status !== 'ready' || adopted.has(generation.id) || generation.kind === 'interview') return;
    const result = generationResultSchema.parse(await http.request(`/generations/${generation.id}/result`));
    adopt(result as unknown as AdoptedDocument);
    adopted.add(generation.id);
  };
  return {
    async getActive() {
      const server = (await http.request('/generations/active')) as { generation: unknown };
      return server.generation ? parse(server.generation) : mock.getActive();
    },
    async get(id) {
      return isServerId(id) ? parse(await http.request(`/generations/${id}`)) : mock.get(id);
    },
    async list() {
      const server = ((await http.request('/generations')) as { items: unknown[] }).items.map(parse);
      const local = await mock.list();
      return [...server, ...local].sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0));
    },
    async start(input) {
      if (!servedOnServer(input)) {
        // On the full backend there is no mock to fall back on: better a plain error than a made-up run.
        if (options.strict) throw new ApiError('UNAVAILABLE', 'This can’t be run right now.', 503);
        // A mock run that starts from a server document reads it from the mock library: copy it there.
        for (const id of [input.baseResumeId, input.sourceResumeId]) {
          if (id && isServerId(id)) adopt(await fetchDocument(http, id));
        }
        return mock.start(input);
      }
      const { tailor, ...rest } = input;
      const body: GenerationRequest = { ...rest, ...(tailor ? { tailoring: toTailoring(tailor) } : {}) };
      // A listing the server serves: its JD first (made from the listing, no model call), then the run.
      if (body.jobId && !body.jdId) body.jdId = (jdDraftSchema.parse(await http.request('/jd', { body: { source: 'job', jobId: body.jobId } })) as { id: string }).id;
      const signature = JSON.stringify(body);
      const earlier = unanswered.get(signature);
      const key = earlier && Date.now() - earlier.at < UNANSWERED_REUSE_MS ? earlier.key : uuid();
      try {
        const started = parse(await http.request('/generations', { body, idempotencyKey: key }));
        unanswered.delete(signature);
        return started;
      } catch (error) {
        if (error instanceof ApiError && error.code === 'NETWORK') unanswered.set(signature, { key, at: earlier?.key === key ? earlier.at : Date.now() });
        else unanswered.delete(signature);
        throw error;
      }
    },
    async retry(id) {
      return isServerId(id) ? parse(await http.request(`/generations/${id}/retry`, { method: 'POST' })) : mock.retry(id);
    },
    async cancel(id) {
      return isServerId(id) ? parse(await http.request(`/generations/${id}/cancel`, { method: 'POST' })) : mock.cancel(id);
    },
    subscribe(id, onChange, onError) {
      if (!isServerId(id)) return mock.subscribe(id, onChange);
      let stopped = false;
      const every = options.everyMs ?? 1000;
      const tick = async () => {
        let failures = 0;
        let failingSince = 0;
        let reported = false;
        while (!stopped) {
          await whileAway(() => stopped, every);
          if (stopped) return;
          let generation: Generation;
          try {
            generation = parse(await http.request(`/generations/${id}`));
          } catch (error) {
            // A run that is gone, not this user's, or in a shape this build can't read will not
            // come right by asking again: say so and stop, instead of polling for ever in silence.
            if (isPermanentPollError(error)) {
              onError?.({ permanent: true, error });
              return;
            }
            // A dropped poll is retried with a growing wait; after a minute of them, the screen hears.
            failures++;
            failingSince ||= Date.now();
            if (!reported && Date.now() - failingSince >= POLL_PATIENCE_MS) {
              reported = true;
              onError?.({ permanent: false, error });
            }
            await new Promise((resolve) => setTimeout(resolve, every * BACKOFF[Math.min(failures, BACKOFF.length) - 1]!));
            continue;
          }
          failures = 0;
          failingSince = 0;
          reported = false;
          // The document is copied in before the final tick, so the ready screen opens it at once.
          // If that copy fails the run is still ready: the screen loads the document itself, and is
          // never left at its last percentage waiting on a copy that keeps failing.
          if (generation.status === 'ready') await finish(generation).catch(() => finish(generation)).catch(() => {});
          if (stopped) return;
          onChange(generation);
          if (generation.status === 'ready' || generation.status === 'failed') return;
          await new Promise((resolve) => setTimeout(resolve, every));
        }
      };
      void tick();
      return () => {
        stopped = true;
      };
    },
  };
}

/** How long a start that got no answer keeps its key for the next press with the same choices. */
const UNANSWERED_REUSE_MS = 10 * 60_000;

/** Waits between failed polls, as multiples of the tick: 1, 2, 5, then 10 for as long as it lasts. */
const BACKOFF = [1, 2, 5, 10];
/** How long polls may keep failing before the screen is told. */
export const POLL_PATIENCE_MS = 60_000;

/** A poll error that asking again won't fix: the run is gone or forbidden, or its shape unreadable. */
export function isPermanentPollError(error: unknown): boolean {
  if (error instanceof NotFoundError) return true;
  if (error instanceof Error && error.name === 'ZodError') return true;
  if (error instanceof ApiError) return error.status === 403 || error.status === 404 || error.status === 410;
  return false;
}

/**
 * Waits while the app is in the background (§196): a poll there spends battery and data on an
 * answer nobody is looking at. `focusManager` follows the app's state on the phone and the tab's
 * visibility on the web; when it comes back the poll resumes at once.
 */
async function whileAway(stopped: () => boolean, everyMs: number): Promise<void> {
  while (!stopped() && !focusManager.isFocused()) {
    await new Promise((resolve) => setTimeout(resolve, everyMs));
  }
}
