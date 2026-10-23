import {
  AUTH_BOARD,
  AUTH_FRAME_HEIGHT,
  SIGN_IN,
  SIGN_UP,
  signInDividerMargin,
  signInBudget,
  signInDrift,
} from '@/features/auth';

/**
 * The arithmetic behind Figma 309:175, with no React in it — the guard `signUpLayout.test.ts`
 * exists for, on the second board that needs it.
 *
 * The board draws a whole phone screen, so its vertical pieces have to account for the whole
 * frame. That makes the sum a transcription guard: a gap measured against a stale revision of
 * the board — which is what happened twice on sign-up — pushes the total off 895 and fails here
 * rather than three screenshots later. It is also what would catch the flow being renumbered
 * and redrawn again, as it was between the first sign-up build and this one.
 */
describe('the sign-in board', () => {
  it('accounts for the whole frame it is drawn on', () => {
    expect(signInBudget()).toBeCloseTo(895, 2);
    expect(signInDrift()).toBeLessThan(0.01);
  });

  it('leaves room for the status bar and the gesture area at both ends', () => {
    // Why these screens take no safe-area edges: the board's own head room and floor already
    // clear the insets, so asking for edges as well would add them a second time.
    expect(SIGN_IN.lockupTop).toBeGreaterThan(47);
    expect(SIGN_IN.floor).toBeGreaterThan(34);
  });

  it('fits a phone without scrolling', () => {
    // 764 of content on a 422.66 board is 745dp on a 412dp-wide phone, against ~892 of screen.
    const content = AUTH_FRAME_HEIGHT - SIGN_IN.floor;
    expect((content * 412) / AUTH_BOARD).toBeLessThan(892);
  });

  it('splits the divider band evenly around its rule', () => {
    expect(signInDividerMargin * 2 + SIGN_IN.dividerTextHeight).toBeCloseTo(SIGN_IN.dividerRow, 6);
  });

  it('does not reuse the field gap for the divider, because the board does not', () => {
    // Sign-up's divider sits at its own field gap and sign-in's does not — 17.09 against 16.11.
    // Reading one off the other is the kind of near-miss a shared constant invites.
    expect(SIGN_IN.dividerGap).not.toBeCloseTo(SIGN_IN.fieldGap, 2);
    expect(SIGN_IN.dividerGap).toBeCloseTo(SIGN_UP.fieldGap, 2);
  });

  it('shares the lock-up and the heading with sign-up, and nothing else about its fields', () => {
    // The two forms open identically — same mark, same wordmark, same gap above the heading —
    // which is why `AuthLockup` is shared. Below that they diverge, which is why `AuthField`
    // takes its box as a prop rather than reading one screen's constants.
    expect(SIGN_IN.lockupTop).toBe(SIGN_UP.lockupTop);
    expect(SIGN_IN.headingTop).toBeCloseTo(SIGN_UP.headingTop, 2);

    expect(SIGN_IN.fieldRadius).not.toBeCloseTo(SIGN_UP.fieldRadius, 2);
    expect(SIGN_IN.fieldIcon).not.toBeCloseTo(SIGN_UP.fieldIcon, 2);
    expect(SIGN_IN.fieldPadding).not.toBeCloseTo(SIGN_UP.fieldPadding, 2);
  });
});
