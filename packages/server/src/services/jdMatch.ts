import { statedOf, statedYearsOf } from '@nextkin/shared/jobs/jdRequirements';
import type { JdMatchBody } from '@nextkin/shared/schemas/jd';

import type { Database, Identity } from '../db/database';
import { matchContext, scoreMatch } from '../jobs/matchScore';
import { getJd } from './jd';

/**
 * The match card on a job description's own page (toreview §110): the listing match (P11-03,
 * `jobmatch-1`), the same engine and the same basis, over what the JD's reading kept. Deterministic,
 * no model call. A JD under 80 words is a snippet: a band and the basis, no number (§105.18).
 * The tools a JD names count as preferred, since it does not say whether they are required.
 */
export async function jdMatch(db: Database, identity: Identity, id: string): Promise<JdMatchBody> {
  const draft = await getJd(db, identity, id);
  if (draft.status !== 'ready') return {};
  const ctx = await db.withUser(identity, (tx) => matchContext(tx, identity.userId));
  const words = draft.rawText.split(/\s+/).filter(Boolean).length;
  // The years the posting asks overall, as its reading placed them (toreview §206.2): the same
  // experience fit a listing's match already applies. The card said nothing of years before.
  const years = draft.structured ? statedYearsOf(draft.structured) : undefined;
  const preferred = [...new Set([...draft.preferredSkills, ...draft.tools.filter((t) => !draft.requiredSkills.includes(t))])];
  const match = scoreMatch({ requiredSkills: draft.requiredSkills, preferredSkills: preferred, descriptionKind: words >= 80 ? 'full' : 'snippet', description: draft.rawText, requirements: [], ...(years ? { experienceYears: years } : {}), ...(draft.structured ? { stated: statedOf(draft.structured) } : {}) }, ctx);
  if (!match) return {};
  // The card's fields only; `sortKey` orders picks and is not shown.
  return { ...(match.matchScore !== undefined ? { matchScore: match.matchScore } : {}), ...(match.matchBand ? { matchBand: match.matchBand } : {}), matchBasis: match.matchBasis, ...(match.matchCriteria ? { matchCriteria: match.matchCriteria } : {}), ...(match.matchReason ? { matchReason: match.matchReason } : {}) };
}
