import { pluralize } from '@/lib';

/**
 * NextKin V2 spec §7.3 — the rules behind the three chip lists on the career profile (skills,
 * desired roles, locations), with no React in them.
 *
 * The screens hold a draft in `useState`; everything that *decides* something about that draft —
 * whether an entry may join it, what it looks like after a remove, whether it has moved away from
 * what the server holds — lives here, so it is unit tested without rendering a page. The same
 * split as `resumes/sectionEdits.ts` and `create/jdSkillEdits.ts`. No react-hook-form and no zod:
 * a list of words is not a schema.
 */

/** How many suggestions the row under the add field offers at once. */
const SUGGESTION_LIMIT = 6;

/** §7.6 forbids a silent failure; this goes on the bar that started the save. */
export const SAVE_FAILED = "We couldn't save that. Check your connection and try again.";

export const DISCARD_TITLE = 'Discard changes?';

export const discardMessage = (noun: string): string =>
  `Your ${noun} changes have not been saved. Going back now leaves your profile as it was.`;

const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/** Collapses the inner whitespace too: "  design   systems " and "Design systems" are one skill. */
const tidy = (value: string): string => value.trim().replace(/\s+/g, ' ');

/**
 * The helper under a capped field, and the reason an add is refused once the cap is reached.
 * §13.5 wants the limit on screen *before* the work, so this line is shown standing rather than
 * only after a refusal.
 */
export const capNote = (max: number): string => `${max} of ${max} — remove one to add another`;

export const atCap = (items: readonly string[], max?: number): boolean =>
  max != null && items.length >= max;

/** Appended, or the reason it was not — a duplicate is never silently dropped. */
export type AddChipResult = { items: string[] } | { refused: string };

export function addChip(
  items: readonly string[],
  value: string,
  noun: string,
  max?: number,
): AddChipResult {
  const trimmed = tidy(value);
  if (trimmed.length === 0) return { refused: `Type a ${noun} first.` };
  if (max != null && items.length >= max) return { refused: capNote(max) };
  // The clash is echoed in the casing already on the list, not the casing just typed: the point
  // of the message is to point at the entry that is already there.
  const clash = items.find((item) => same(item, trimmed));
  if (clash != null) return { refused: `${clash} is already on your list.` };
  return { items: [...items, trimmed] };
}

export const removeChip = (items: readonly string[], value: string): string[] =>
  items.filter((item) => item !== value);

/** Order counts: a list the user reordered is a list the user changed. */
export const listsEqual = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((item, index) => item === b[index]);

/** "12 skills" — the uncapped count line. */
export const countOf = (count: number, noun: string): string => pluralize(count, noun);

/** "3 of 5" — the capped one, worded exactly as the Profile tab's row reads it. */
export const countCapped = (count: number, max: number): string => `${count} of ${max}`;

/**
 * What the row under the field offers: entries from the shipped vocabulary that are not on the
 * list already, narrowed by whatever has been typed so far. Case-insensitive on both halves, so
 * typing "ux" reaches "Senior UX Designer" and never re-offers a role already chosen.
 */
export function filterSuggestions(
  pool: readonly string[],
  chosen: readonly string[],
  query: string,
  limit: number = SUGGESTION_LIMIT,
): string[] {
  const needle = tidy(query).toLowerCase();
  const taken = new Set(chosen.map((item) => item.toLowerCase()));
  return pool
    .filter((item) => {
      const key = item.toLowerCase();
      return !taken.has(key) && (needle.length === 0 || key.includes(needle));
    })
    .slice(0, limit);
}
