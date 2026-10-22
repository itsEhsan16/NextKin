/**
 * The onboarding and auth artboards (Figma 307:4152) are drawn at 422.66 — a third width, neither
 * the 520 "Mobile App" board every other screen is measured on nor the 390 one projected from it.
 * Those sections are already phone-sized, so their numbers are ~1.23x smaller than the same
 * element drawn at 520; reading them as 520 numbers would render the whole flow a quarter small.
 *
 * `board()` converts a drawn length into the 520-space `theme.s()` scales from, so measurements
 * stay traceable to their node:
 *
 *     paddingLeft: s(board(43))   // 290:972 is 43 from the left edge of a 422.66 frame
 *
 * The welcome screen and slide 1 are drawn 1.9% narrower again (414.67). That difference is
 * frame drift rather than intent — the layout numbers on them are identical to slides 2 and 3 —
 * so the whole flow is normalised onto one board. See toreview.md.
 *
 * The type ramp does the same conversion for font sizes; see `authRole` in `src/theme/typography`.
 */
export const AUTH_BOARD = 422.66;

/**
 * The board's frame height — and the reason none of these screens takes safe-area edges.
 *
 * Summed down any of the six artboards, the drawn offsets account for all 895: sign-up runs from
 * 97 of head room to a 44.47 floor and lands on 894.9. So the frame is a whole phone screen, the
 * status bar and gesture area included, and the padding at each end is already the allowance for
 * them. A `<Screen edges={['top', 'bottom']}>` adds those insets a second time — about 80dp of
 * space that is in neither the design nor the device — which is what pushed sign-up's last
 * button under its footer.
 *
 * So: `edges={[]}`, and where the board's own allowance is thinner than the inset it was drawn
 * for (the slides give "Skip" only 41), take whichever is larger.
 */
export const AUTH_FRAME_HEIGHT = 895;

/** The 520 design width, as a literal: `sizes` may not be imported as a value (ESLint). */
const DESIGN_WIDTH = 520;

export const board = (px: number): number => (px * DESIGN_WIDTH) / AUTH_BOARD;
