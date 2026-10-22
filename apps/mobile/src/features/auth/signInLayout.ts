import { AUTH_FRAME_HEIGHT } from './board';

/**
 * Every measurement on Figma 309:175, as drawn on the 422.66 board — and, taken together, a
 * check on itself. The sibling of `signUpLayout.ts`, for the same reason it exists.
 *
 * Sign-in and sign-up are the same form drawn twice, and they are *not* drawn identically. The
 * fields here are 0.31 taller, 2.07 less round, 1.19 wider in the glyph and 0.99 closer
 * together; the divider gap is the sign-up field gap while this screen's field gap is not. Those
 * are small, but they are what the board says, and CLAUDE.md rule 7 says a screen with an
 * artboard comes from that artboard. So `AuthField` takes its metrics from whichever screen is
 * using it rather than from a constant, and the two objects differ where the boards differ.
 *
 * What is *not* taken from the board is the gutter: the fields are drawn at 22.07 from the left
 * and the buttons at 24.02, a 1.95 disagreement between elements that are plainly meant to line
 * up. That is drift, of the kind `board.ts` already normalises away for the frame width, so one
 * gutter is used — sign-up's 23.68, which is also where this board puts the back chevron.
 */
export const SIGN_IN = {
  /** Out of the flow — the board sets the chevron beside the lock-up, not above it. */
  backX: 23.68359,
  backY: 52.11011,
  backGlyph: 23.5038,

  gutter: 23.68,
  lockupTop: 97,
  markHeight: 54.78323,
  lockupGap: 6.28442,
  wordmarkHeight: 38.10203,

  headingTop: 20.06282,
  headingHeight: 38,

  fieldsTop: 80.35223,
  fieldHeight: 61.20611,
  fieldGap: 16.10688,
  fieldCount: 2,
  fieldRadius: 13.959,
  fieldPadding: 20.4023,
  fieldIcon: 23.62341,
  fieldIconGap: 22.5497,
  fieldErrorGap: 6,

  /** "Forgot password?", right-aligned, with its own floor under it. */
  forgotTop: 16.10688,
  forgotHeight: 17,
  forgotFloor: 20.40204,

  ctaTop: 15.67054,
  ctaHeight: 58.75949,
  ctaArrow: 24.57215,
  ctaArrowRight: 30.98,

  /** The "or" band: a 65.17 row with its rule centred, so the margin is what is left either side. */
  dividerRow: 65.16962,
  dividerTextHeight: 19,
  /** Not `fieldGap`: the board sets the rules 17.09 off the word, and the fields 16.11 apart. */
  dividerGap: 17.0937,

  googleHeight: 59.82785,
  googleLogo: 25.64051,
  googleGap: 16.025,

  footerTop: 21,
  footerHeight: 17,
  footerGap: 5.3797,
  floor: 130.96191,

  hairline: 1.068,
} as const;

/** Half the divider band, which is what the row carries as margin above and below. */
export const signInDividerMargin = (SIGN_IN.dividerRow - SIGN_IN.dividerTextHeight) / 2;

/** Everything the page stacks, top to bottom. Should come back as the frame height. */
export function signInBudget(): number {
  return (
    SIGN_IN.lockupTop +
    SIGN_IN.markHeight +
    SIGN_IN.lockupGap +
    SIGN_IN.wordmarkHeight +
    SIGN_IN.headingTop +
    SIGN_IN.headingHeight +
    SIGN_IN.fieldsTop +
    SIGN_IN.fieldHeight * SIGN_IN.fieldCount +
    SIGN_IN.fieldGap * (SIGN_IN.fieldCount - 1) +
    SIGN_IN.forgotTop +
    SIGN_IN.forgotHeight +
    SIGN_IN.forgotFloor +
    SIGN_IN.ctaTop +
    SIGN_IN.ctaHeight +
    SIGN_IN.dividerRow +
    SIGN_IN.googleHeight +
    SIGN_IN.footerTop +
    SIGN_IN.footerHeight +
    SIGN_IN.floor
  );
}

/** How far the budget is from the frame it has to fill. */
export const signInDrift = (): number => Math.abs(signInBudget() - AUTH_FRAME_HEIGHT);
