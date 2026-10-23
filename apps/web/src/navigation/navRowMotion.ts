/**
 * A nav row's transition, as a class string.
 *
 * Two different speeds live on one element. The hover fill (`background-color`) stays at
 * `duration-press` (120ms) — the project's existing press-feedback convention — while the row's
 * own size (width/height/padding/gap, which is what makes collapse/expand read as one motion
 * with the panel around it) eases over `duration-base` (220ms). The current row's pill and ring
 * aren't the row's any more — `SlidingHighlight` draws them and glides them between rows — and
 * the icon and label recolour on their own elements, so neither needs a slot here
 * (`toreview.md` §29). Tailwind's `transition-*` utilities can only set one duration for the
 * whole element, so getting two durations on one node means writing the `transition` shorthand
 * by hand via Tailwind's arbitrary-property syntax — every value here is still
 * `var(--transition-duration-press|base)`/`var(--ease-standard)`, the same tokens `theme.css`
 * defines, just assembled for this one case rather than a new value. The `transition-duration-`
 * prefix (not a bare `--duration-`) is deliberate — see the note above
 * `--transition-duration-press` in `theme.css`.
 *
 * This has to be ONE unbroken string literal, not built from concatenated fragments. Tailwind's
 * class scanner works on the raw text of this file, not on the JS value it evaluates to — it
 * looks for a balanced `[...]` token to recognise an arbitrary property. Split across several
 * `'...' + '...'` pieces (as an earlier version of this file did), the bracket is never complete
 * in any one literal, so the scanner never sees a candidate and generates no CSS at all — the
 * whole rule silently disappears, decays to a default `transition-duration: 0s`, and every row
 * snaps instead of easing. `__tests__/navigation/navRowMotion.test.ts` guards against this
 * regressing again.
 */
export const navRowTransition =
  '[transition:background-color_var(--transition-duration-press)_var(--ease-standard),width_var(--transition-duration-base)_var(--ease-standard),height_var(--transition-duration-base)_var(--ease-standard),padding_var(--transition-duration-base)_var(--ease-standard),gap_var(--transition-duration-base)_var(--ease-standard)]';
