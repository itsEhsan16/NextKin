import {
  AUTH_BOARD,
  AUTH_FRAME_HEIGHT,
  SIGN_UP,
  dividerMargin,
  signUpBudget,
  signUpDrift,
} from '@/features/auth';

/**
 * The arithmetic behind Figma 307:4386, with no React in it.
 *
 * The board draws a whole phone screen, so its vertical pieces have to account for the whole
 * frame. That makes the sum a transcription guard: a gap measured against a stale revision of
 * the board — which is what happened, twice — pushes the total off 895 and fails here rather
 * than three screenshots later.
 */
describe('the sign-up board', () => {
  it('accounts for the whole frame it is drawn on', () => {
    // 894.9 against 895: the shortfall is rounding in the drawn offsets, not a missing element.
    expect(signUpBudget()).toBeCloseTo(894.9, 1);
    expect(signUpDrift()).toBeLessThan(1);
  });

  it('would have caught the gap that was measured against the old board', () => {
    // The section moved from y=269.35 to 197 in a revision. Reading `headingTop` off the older
    // number gives 92.41 instead of 20.06 — 72 of space that is in no version of the design.
    const stale = signUpBudget() - SIGN_UP.headingTop + 92.41;
    expect(Math.abs(stale - AUTH_FRAME_HEIGHT)).toBeGreaterThan(70);
  });

  it('leaves room for the status bar and the gesture area at both ends', () => {
    // Why these screens take no safe-area edges: the board's own head room and floor already
    // clear the insets, so asking for edges as well would add them a second time.
    expect(SIGN_UP.lockupTop).toBeGreaterThan(47);
    expect(SIGN_UP.floor).toBeGreaterThan(34);
  });

  it('fits a phone without scrolling', () => {
    // 765 of content on a 422.66 board is 745dp on a 412dp-wide phone, against ~892 of screen.
    const content = AUTH_FRAME_HEIGHT - SIGN_UP.floor;
    expect((content * 412) / AUTH_BOARD).toBeLessThan(892);
  });

  it('splits the divider band evenly around its rule', () => {
    expect(dividerMargin * 2 + SIGN_UP.dividerTextHeight).toBeCloseTo(SIGN_UP.dividerRow, 6);
  });
});
