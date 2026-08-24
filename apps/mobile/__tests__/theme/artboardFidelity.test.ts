import { themeFor } from '@/theme';

/**
 * The screens that prompted this work, checked as ratios rather than pixels.
 *
 * Every complaint was the same shape: an element kept its 520px artboard size while the box
 * around it shrank, so the text no longer fit. A ratio-of-frame assertion catches that directly
 * — and, unlike a pixel value, it holds on every device.
 */
const DESIGN = 520;
const GUTTER = 24;
const CONTENT = DESIGN - GUTTER * 2; // 472 — the artboard's content column

/** Real phone widths, narrowest first. The user's device is a 360dp Android. */
const DEVICES = [320, 360, 375, 390, 412, 430];

const ratio = (value: number, width: number) => value / width;

describe('artboard fidelity', () => {
  it.each(DEVICES)('keeps the content column at the artboard share on %ddp', (width) => {
    const theme = themeFor('light', width);
    expect(ratio(theme.contentWidth, width)).toBeCloseTo(CONTENT / DESIGN, 6);
  });

  it.each(DEVICES)('keeps body text at its designed share of the frame on %ddp', (width) => {
    const { typography } = themeFor('light', width);
    // Figma body is 15 on a 520 frame. Before this change it stayed 15 on a 360 frame, i.e.
    // 44% larger relative to the column it had to fit inside.
    expect(ratio(typography.body.fontSize ?? 0, width)).toBeCloseTo(15 / DESIGN, 6);
    expect(ratio(typography.screenTitle.fontSize ?? 0, width)).toBeCloseTo(28 / DESIGN, 6);
    expect(ratio(typography.hero.fontSize ?? 0, width)).toBeCloseTo(46 / DESIGN, 6);
  });

  it.each(DEVICES)('keeps the profile ring at its designed share of the frame on %ddp', (width) => {
    // PROFILE 01 draws a 104pt ring on a 520 frame — 20% of it. The screenshot that started
    // this showed it at 28.9%, because the ring was raw and the frame was not.
    const { s } = themeFor('light', width);
    expect(ratio(s(104), width)).toBeCloseTo(104 / DESIGN, 6);
  });

  it.each(DEVICES)('holds text against the box it sits in on %ddp', (width) => {
    const theme = themeFor('light', width);
    // The invariant the old policy broke: type and layout must shrink together.
    expect((theme.typography.body.fontSize ?? 0) / theme.spacing.gutter).toBeCloseTo(15 / 24, 6);
    expect((theme.typography.displaySemiBold.fontSize ?? 0) / theme.contentWidth).toBeCloseTo(
      22 / CONTENT,
      6,
    );
  });
});
