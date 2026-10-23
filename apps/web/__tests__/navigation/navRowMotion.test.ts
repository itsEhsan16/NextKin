import { navRowTransition } from '@/navigation/navRowMotion';

/**
 * Guards the exact bug that shipped once already: `navRowTransition` was originally assembled
 * from several `'...' + '...'` string fragments, splitting the arbitrary-property bracket across
 * more than one literal. Tailwind's class scanner reads this file's raw *source text* looking for
 * a complete, balanced `[...]` token — it does not evaluate the JS concatenation — so a fragment
 * that opens `[` in one literal and closes `]` in another is invisible to it. No candidate, no
 * generated CSS, and every nav row's collapse/expand snapped instead of easing, silently, with
 * nothing at the DOM/render level (jsdom has no real CSS pipeline) able to catch it. This is a
 * static, string-level check instead: `navRowMotion.ts`'s own comment explains why it exists.
 */
describe('navRowTransition', () => {
  it('is one Tailwind arbitrary-property token: starts and ends the bracket, well-balanced', () => {
    expect(navRowTransition.startsWith('[transition:')).toBe(true);
    expect(navRowTransition.endsWith(']')).toBe(true);

    // Exactly one opening and one closing square bracket — proof it's a single token, not a
    // fragment that happens to contain a stray `[` or `]` from something else.
    expect(navRowTransition.match(/\[/g)).toHaveLength(1);
    expect(navRowTransition.match(/\]/g)).toHaveLength(1);

    const opens = navRowTransition.match(/\(/g)?.length ?? 0;
    const closes = navRowTransition.match(/\)/g)?.length ?? 0;
    expect(opens).toBe(closes);
    expect(opens).toBeGreaterThan(0);

    // Tailwind's arbitrary-value syntax needs underscores, not raw spaces, inside the brackets —
    // a literal space would also mean the string got broken into two separate class candidates.
    expect(navRowTransition).not.toMatch(/\s/);
  });

  it('carries both durations it exists to combine, on every property that needs them', () => {
    // `--transition-duration-*`, not a bare `--duration-*` — see the note in navRowMotion.ts and
    // theme.css: that's the namespace Tailwind's `duration-*` utility actually reads from.
    // Only the hover fill runs at press speed on the row itself. The current row's pill and ring,
    // and the icon and label colours, transition on their own elements (`SlidingHighlight`, and
    // `NavRow`'s children — `toreview.md` §29).
    expect(navRowTransition).toContain(
      'background-color_var(--transition-duration-press)_var(--ease-standard)',
    );
    for (const prop of ['width', 'height', 'padding', 'gap']) {
      expect(navRowTransition).toContain(
        `${prop}_var(--transition-duration-base)_var(--ease-standard)`,
      );
    }
  });
});
