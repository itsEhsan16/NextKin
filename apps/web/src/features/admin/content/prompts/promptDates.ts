/**
 * A prompt's dates are moments (a publish, an eval, a draft, a save), so they're shown in the
 * viewer's own zone, as their times are: an eval run at 01:10 on Nov 6 reads "Nov 6, 01:10". The
 * prompt fixtures hold the board's days at local noon to match (`toreview.md` §171.9).
 */
export function formatPromptDay(iso: string | null, withYear = true): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}
