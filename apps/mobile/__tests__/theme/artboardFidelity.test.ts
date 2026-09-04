import { themeFor } from '@/theme';

/**
 * The screens that prompted this work, checked as ratios rather than pixels.
 *
 * Every complaint was the same shape: an element kept its 520px artboard size while the box
 * around it shrank, so the text no longer fit. A ratio-of-frame assertion catches that directly
 * — and, unlike a pixel value, it holds on every device.
 *
 * Geometry still answers to a single factor, and the Figma "Mobile 2" page is the evidence: at
 * 390 it is the 520 page at exactly 0.75, node for node. The geometry cases below are therefore
 * unchanged, and their staying green is the proof that adding the second type anchor moved no
 * layout. Type is the half that Mobile 2 deliberately bends, so it is pinned to that board's
 * measurements instead of to a share of the frame.
 */
const DESIGN = 520;
const NARROW = 390;
const GUTTER = 24;
const CONTENT = DESIGN - GUTTER * 2; // 472 — the artboard's content column

/** Real phone widths, narrowest first. The user's device is a 360dp Android. */
const DEVICES = [320, 360, 375, 390, 412, 430];

const ratio = (value: number, width: number) => value / width;

describe('artboard fidelity — geometry', () => {
  it.each(DEVICES)('keeps the content column at the artboard share on %ddp', (width) => {
    const theme = themeFor('light', width);
    expect(ratio(theme.contentWidth, width)).toBeCloseTo(CONTENT / DESIGN, 6);
  });

  it.each(DEVICES)('keeps the profile ring at its designed share of the frame on %ddp', (width) => {
    // PROFILE 01 draws a 104pt ring on a 520 frame — 20% of it. The screenshot that started
    // this showed it at 28.9%, because the ring was raw and the frame was not.
    const { s } = themeFor('light', width);
    expect(ratio(s(104), width)).toBeCloseTo(104 / DESIGN, 6);
  });

  it('lands the 390 board on exactly three-quarters of the 520 one', () => {
    // The whole premise of this change: Mobile 2 is Mobile App × 0.75 for every length.
    const wide = themeFor('light', DESIGN);
    const narrow = themeFor('light', NARROW);
    expect(narrow.scale).toBeCloseTo(0.75, 9);
    expect(narrow.spacing.gutter).toBeCloseTo(wide.spacing.gutter * 0.75, 9);
    expect(narrow.sizes.tabBarHeight).toBeCloseTo(wide.sizes.tabBarHeight * 0.75, 9);
    expect(narrow.radii.card).toBeCloseTo(wide.radii.card * 0.75, 9);
    expect(narrow.contentWidth).toBeCloseTo(wide.contentWidth * 0.75, 9);
  });
});

describe('artboard fidelity — type', () => {
  it('reads each board at its own width', () => {
    const wide = themeFor('light', DESIGN).typography;
    const narrow = themeFor('light', NARROW).typography;

    // Measured on both artboards. The layout between them is a flat ×0.75; these are not.
    expect(wide.body.fontSize).toBeCloseTo(15, 9);
    expect(narrow.body.fontSize).toBeCloseTo(13, 9);

    expect(wide.screenTitle.fontSize).toBeCloseTo(28, 9);
    expect(narrow.screenTitle.fontSize).toBeCloseTo(22, 9);

    // Hero inverts the pair: 210:262 draws it at 390, so 32 is the measurement and the wide
    // anchor is derived from it. State it as that division rather than as a second number,
    // so the test says which of the two is the one somebody read off a board.
    expect(narrow.hero.fontSize).toBeCloseTo(32, 9);
    expect(wide.hero.fontSize).toBeCloseTo(32 / (NARROW / DESIGN), 9);

    expect(wide.caption.fontSize).toBeCloseTo(13, 9);
    expect(narrow.caption.fontSize).toBeCloseTo(11.5, 9);

    // The nav label answers to the pill, not the boards: 215:490 grew the bar, so the label was
    // sized to it rather than scaled with it (which would have put it at 7.28).
    expect(wide.tabLabel.fontSize).toBeCloseTo(17.6, 9);
    expect(narrow.tabLabel.fontSize).toBeCloseTo(13.2, 9);
  });

  it.each(DEVICES)('never lets type shrink faster than the layout on %ddp', (width) => {
    // The invariant that makes "readable" a property of the system rather than of one table:
    // below the 520 board, every role sits at or above the line geometry follows.
    //
    // This used to carry an exemption list — the Home tiles, which the boards squeeze under the
    // line to fit a one-line label into a narrow cell. Letting those labels wrap emptied it, so
    // the rule now holds for every role in the ramp with nothing skipped. Keep it that way: an
    // exemption here means some text is shrinking faster than the box around it.
    const { typography } = themeFor('light', width);
    const wide = themeFor('light', DESIGN).typography;

    for (const role of Object.keys(typography) as (keyof typeof typography)[]) {
      const geometryLine = ((wide[role].fontSize ?? 0) * width) / DESIGN;
      expect(typography[role].fontSize ?? 0).toBeGreaterThanOrEqual(geometryLine - 1e-9);
    }
  });

  it.each(DEVICES)('holds body text above its old, too-small size on %ddp', (width) => {
    // What this change is for. The old policy put body at 15 × width/520 — 10.4dp on the 360dp
    // Android that prompted it. Mobile 2 lifts it without moving a single box.
    const body = themeFor('light', width).typography.body.fontSize ?? 0;
    expect(body).toBeGreaterThan((15 * width) / DESIGN);
  });

  it('holds the narrow board below 390, and reads between the two above it', () => {
    const at = (width: number) => themeFor('light', width).typography.body.fontSize ?? 0;

    // 390 is already a phone width, so it is the floor rather than a midpoint. Under it the
    // boxes keep scaling but the type holds, which is what keeps it legible on a 360dp screen.
    expect(at(320)).toBeCloseTo(13, 9); // against 9.23 under the old policy
    expect(at(360)).toBeCloseTo(13, 9); // against 10.38
    expect(at(NARROW)).toBeCloseTo(13, 9);

    // Above it, towards the 520 board. Continuous at 390 — the two branches agree there.
    expect(at(430)).toBeCloseTo(13 + (2 * (430 - NARROW)) / (DESIGN - NARROW), 9);
    expect(at(DESIGN)).toBeCloseTo(15, 9);
  });
});
