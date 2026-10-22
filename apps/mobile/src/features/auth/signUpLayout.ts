import { AUTH_FRAME_HEIGHT } from './board';

/**
 * Every measurement on Figma 307:4386, as drawn on the 422.66 board — and, taken together, a
 * check on itself.
 *
 * The artboard budgets a whole phone screen, so its vertical pieces have to account for all 895
 * of the frame. `signUpBudget()` adds them up and the test beside it holds that sum, which makes
 * a mis-measured gap fail immediately instead of on a device: an earlier build put `headingTop`
 * at 92.41 (measured against a revision where the section began at y=269.35 rather than 197) and
 * nothing caught it until the screen was photographed.
 *
 * So: when the board moves, re-measure and let the sum tell you whether you got it all.
 */
export const SIGN_UP = {
  /** Out of the flow — the board sets the chevron beside the lock-up, not above it. */
  backX: 23.68,
  backY: 52.11,
  backGlyph: 23.5,

  gutter: 23.68,
  lockupTop: 97,
  markHeight: 54.78,
  lockupGap: 6.29,
  wordmarkHeight: 38,

  headingTop: 20.06,
  headingHeight: 38,

  fieldsTop: 33.78,
  fieldHeight: 60.896,
  fieldGap: 17.09,
  fieldCount: 3,
  fieldRadius: 16.025,
  fieldPadding: 21.367,
  fieldIcon: 22.435,
  fieldIconGap: 20.3,
  fieldErrorGap: 6,

  ctaTop: 37.4,
  ctaHeight: 58.76,
  ctaArrow: 24.57,
  ctaArrowRight: 30.98,

  /** The "or" band: a 65.17 row with its rule centred, so the margin is what is left either side. */
  dividerRow: 65.17,
  dividerTextHeight: 19,

  googleHeight: 59.83,
  googleLogo: 25.64,
  googleGap: 16,

  footerTop: 20.96,
  footerHeight: 18,
  floor: 130,

  hairline: 1.068,
} as const;

/** Half the divider band, which is what the row carries as margin above and below. */
export const dividerMargin = (SIGN_UP.dividerRow - SIGN_UP.dividerTextHeight) / 2;

/** Everything the page stacks, top to bottom. Should come back as the frame height. */
export function signUpBudget(): number {
  return (
    SIGN_UP.lockupTop +
    SIGN_UP.markHeight +
    SIGN_UP.lockupGap +
    SIGN_UP.wordmarkHeight +
    SIGN_UP.headingTop +
    SIGN_UP.headingHeight +
    SIGN_UP.fieldsTop +
    SIGN_UP.fieldHeight * SIGN_UP.fieldCount +
    SIGN_UP.fieldGap * (SIGN_UP.fieldCount - 1) +
    SIGN_UP.ctaTop +
    SIGN_UP.ctaHeight +
    SIGN_UP.dividerRow +
    SIGN_UP.googleHeight +
    SIGN_UP.footerTop +
    SIGN_UP.footerHeight +
    SIGN_UP.floor
  );
}

/** How far the budget is from the frame it has to fill. */
export const signUpDrift = (): number => Math.abs(signUpBudget() - AUTH_FRAME_HEIGHT);
