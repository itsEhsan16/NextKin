import type { Certification, ConfirmFacts, Education, Experience, Profile, ProfileLink } from '../../models/profile';
import { gapQuestionListSchema, profileSchema } from '../../schemas/profile';
import { NotFoundError } from '../state';
import type { ProfileRepo } from '../types';
import { ApiError, newIdempotencyKey, type HttpClient } from './client';

/**
 * `ProfileRepo` over `/api/v1/profile` (ImBackendImplementationPlan P5-04). Every method is served.
 *
 * - Every response is the whole profile; completeness and next steps are the server's, derived
 *   from the data.
 * - Identity and preference writes are conditional (If-Match). The repo keeps the last ETag and,
 *   on 412/428, reloads and re-sends once: these writes merge single fields, so re-applying one on
 *   fresh data cannot drop anyone else's change.
 * - Upserts keep the mock's contract: an id the server issued replaces that entry; an empty,
 *   client-minted or unknown id appends a new one with a server id. Creates carry an
 *   Idempotency-Key, so the one network retry cannot add a row twice.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Section = 'experience' | 'education' | 'certifications' | 'links';

export function createHttpProfileRepo(http: HttpClient): ProfileRepo & { reset(): void } {
  let etag: string | null = null;

  const accept = (data: unknown, nextEtag: string | null): Profile => {
    if (nextEtag) etag = nextEtag;
    return profileSchema.parse(data);
  };

  const load = async (): Promise<Profile> => {
    const result = await http.send('/profile');
    return accept(result.data, result.etag);
  };

  const call = async (path: string, init: Parameters<HttpClient['send']>[1]): Promise<Profile> => {
    const result = await http.send(path, init);
    return accept(result.data, result.etag);
  };

  const conditional = async (path: string, body: unknown): Promise<Profile> => {
    if (!etag) await load();
    try {
      return await call(path, { method: 'PATCH', body, headers: { 'if-match': etag! } });
    } catch (error) {
      const stale = error instanceof ApiError && (error.code === 'PRECONDITION_FAILED' || error.code === 'PRECONDITION_REQUIRED');
      if (!stale) throw error;
      await load();
      return call(path, { method: 'PATCH', body, headers: { 'if-match': etag! } });
    }
  };

  const strip = <T extends { id: string }>(entry: T): Omit<T, 'id'> => {
    const { id: _id, ...rest } = entry;
    return rest;
  };

  async function upsert<T extends { id: string }>(section: Section, entry: T): Promise<Profile> {
    const create = () => call(`/profile/${section}`, { method: 'POST', body: strip(entry), idempotencyKey: newIdempotencyKey() });
    if (!UUID.test(entry.id)) return create();
    try {
      return await call(`/profile/${section}/${entry.id}`, { method: 'PUT', body: strip(entry) });
    } catch (error) {
      if (error instanceof NotFoundError) return create();
      throw error;
    }
  }

  const remove = (section: Section, id: string) => call(`/profile/${section}/${encodeURIComponent(id)}`, { method: 'DELETE' });

  return {
    reset: () => {
      etag = null;
    },
    getProfile: load,
    completeNextStep: (id) => call(`/profile/next-steps/${encodeURIComponent(id)}/complete`, { method: 'POST' }),
    updatePreferences: (patch) => conditional('/profile/preferences', patch),
    updateProfile: (patch) => conditional('/profile', patch),
    upsertExperience: (entry: Experience) => upsert('experience', entry),
    removeExperience: (id) => remove('experience', id),
    upsertEducation: (entry: Education) => upsert('education', entry),
    removeEducation: (id) => remove('education', id),
    updateSkills: (skills) => call('/profile/skills', { method: 'PUT', body: { skills } }),
    upsertCertification: (entry: Certification) => upsert('certifications', entry),
    removeCertification: (id) => remove('certifications', id),
    upsertLink: (entry: ProfileLink) => upsert('links', entry),
    removeLink: (id) => remove('links', id),
    confirmFacts: (input: ConfirmFacts) => call('/profile/confirm', { method: 'POST', body: input }),
    getGapQuestions: async () => gapQuestionListSchema.parse(await http.request('/profile/gaps')).questions,
    answerGap: async (id, answer) => gapQuestionListSchema.parse(await http.request(`/profile/gaps/${encodeURIComponent(id)}`, { method: 'POST', body: answer })).questions,
    applyProfileDraft: (draft) => call('/profile/draft', { method: 'POST', body: draft, idempotencyKey: newIdempotencyKey() }),
  };
}
