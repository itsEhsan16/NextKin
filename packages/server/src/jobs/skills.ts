import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { mentionsIn, resolveSkill } from '@nextkin/engines/normalizer';

/**
 * The skills a listing asks for, read without a model (P11-03: rendering a job card makes zero AI
 * calls). Required: the listing's own tags and every known skill its requirements name. Preferred:
 * known skills its responsibilities and description name that the required list lacks. A tag the
 * taxonomy does not know stays as written; the matcher compares it by phrase.
 */
export function listingSkills(listing: { tags: readonly string[]; requirements: readonly string[]; responsibilities: readonly string[]; description: string }): {
  requiredSkills: string[];
  preferredSkills: string[];
} {
  const seen = new Set<string>();
  const required: string[] = [];
  const add = (list: string[], name: string) => {
    const id = resolveSkill(TAXONOMY, name).id;
    if (seen.has(id)) return;
    seen.add(id);
    list.push(name);
  };
  for (const tag of listing.tags) add(required, tag);
  for (const line of listing.requirements) for (const m of mentionsIn(TAXONOMY, line)) add(required, m.name);
  const preferred: string[] = [];
  for (const text of [...listing.responsibilities, listing.description]) for (const m of mentionsIn(TAXONOMY, text)) add(preferred, m.name);
  return { requiredSkills: required.slice(0, 40), preferredSkills: preferred.slice(0, 40) };
}
