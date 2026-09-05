import {
  atsQuickWins,
  RESUME_SECTION_LABEL,
  type AtsCheckItem,
  type AtsFixTarget,
  type AtsScore,
} from '@/data/models';

/**
 * The row model behind the AI fix screen (V2 §7.8), kept pure and out of the screen for the
 * reason `jdSkillEdits` is: "which checks are on this list, and in what order" is a rule about
 * the score, not about the page that renders it.
 *
 * The rule it exists to enforce: applying a fix makes the check PASS, so it leaves
 * `atsQuickWins` on the next score — and a card that vanished at the moment it succeeded would
 * read as the fix being thrown away. The list is therefore the union of what is still to do,
 * what this session has already applied, and the gaps the product will never write, held in a
 * first-seen order that no re-score can reshuffle.
 */

export type FixRowState = 'todo' | 'applying' | 'done' | 'gap';

export type FixRow = { item: AtsCheckItem; state: FixRowState };

export type FixRowsInput = {
  score?: AtsScore;
  /** Snapshot of every item applied this session, by id — the card outlives its quick win. */
  applied: Record<string, AtsCheckItem>;
  applyingId?: string;
  /** First-seen ids, oldest first. `mergeOrder` maintains it. */
  order: readonly string[];
};

/**
 * The unsupported keywords (V2 §7.8): a JD term nothing on the profile backs. They carry
 * `fixable: false`, so `atsQuickWins` excludes them and they have to be read off the sections
 * directly. They are shown and never inserted — there is no Apply for a gap.
 */
export function atsGaps(score: AtsScore): AtsCheckItem[] {
  return score.sections
    .flatMap((section) => section.items)
    .filter((item) => item.supported === false);
}

/** Every id the screen has a card for, in the score's own order: quick wins, then the gaps. */
export function fixRowIds(score: AtsScore | undefined): string[] {
  if (!score) return [];
  return [...atsQuickWins(score), ...atsGaps(score)].map((item) => item.id);
}

/**
 * Appends ids the order has not seen yet, and returns the SAME array when there are none — the
 * screen re-runs this on every score, and a fresh array each time would loop its effect.
 */
export function mergeOrder(order: readonly string[], ids: readonly string[]): string[] {
  const seen = new Set(order);
  const added = ids.filter((id) => !seen.has(id));
  return added.length === 0 ? (order as string[]) : [...order, ...added];
}

function stateFor(
  id: string,
  input: FixRowsInput,
  isGap: boolean,
  item: AtsCheckItem,
): FixRowState {
  // Gap first, and unconditionally: nothing can apply one, so no other state may claim it.
  if (isGap) return 'gap';
  if (input.applyingId === id) return 'applying';
  // Two ways to be done, and both are the truth on screen. `passed` covers a check some OTHER
  // fix carried over the line — one edit can settle two — and `applied` covers the mirror case,
  // an edit that landed while the re-score still reads the check as unmet: the write happened,
  // and offering it again would invite the reader to make it twice.
  if (item.passed || input.applied[id]) return 'done';
  return 'todo';
}

export function fixRows(input: FixRowsInput): FixRow[] {
  const { score, applied, order } = input;

  // Every check, not only the unmet ones: a row that has been on this list stays on it, and its
  // current `passed` is what turns it into a tick rather than removing it from the page.
  const all = new Map<string, AtsCheckItem>();
  const gaps = new Set<string>();
  const listed: string[] = [];
  if (score) {
    for (const section of score.sections) {
      for (const item of section.items) all.set(item.id, item);
    }
    for (const item of atsGaps(score)) gaps.add(item.id);
    listed.push(...fixRowIds(score));
  }

  const rows: FixRow[] = [];
  const placed = new Set<string>();
  const push = (id: string) => {
    if (placed.has(id)) return;
    // The live item wins over the snapshot: its label is the one the latest score wrote.
    const item = all.get(id) ?? applied[id];
    if (!item) return;
    placed.add(id);
    rows.push({ item, state: stateFor(id, input, gaps.has(id), item) });
  };

  for (const id of order) push(id);
  // Anything the order has not caught up with yet — the first render, before the effect runs.
  for (const id of listed) push(id);
  for (const id of Object.keys(applied)) push(id);

  return rows;
}

export const todoItems = (rows: readonly FixRow[]): AtsCheckItem[] =>
  rows.filter((row) => row.state === 'todo').map((row) => row.item);

/**
 * The section a fix lands in, named the way the editor names it. `'links'` is not one of §7.11's
 * six sections — it is `ResumeContent.links` — so `RESUME_SECTION_LABEL` cannot label it and it
 * is spelled out here.
 */
export function fixSectionLabel(section: AtsFixTarget | undefined): string | undefined {
  if (!section) return undefined;
  return section === 'links' ? 'Links' : RESUME_SECTION_LABEL[section];
}
