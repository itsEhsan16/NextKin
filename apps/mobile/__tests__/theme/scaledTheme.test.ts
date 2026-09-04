import { Dimensions } from 'react-native';

import {
  buildShadows,
  darkTheme,
  lightTheme,
  radii,
  shadowSpecs,
  sizes,
  spacing,
  themeFor,
  typography,
  type TypographyRole,
} from '@/theme';

const DESIGN = 520;
const IPHONE_14 = 390;
const K = IPHONE_14 / DESIGN; // 0.75 exactly

/**
 * The two Home tile labels, which answer to neither board: both draw them on one line inside a
 * narrow cell, which caps them below what anyone can read. They wrap to two lines instead and
 * carry their own leading, so they are named here rather than silently skipped.
 */
describe('the Jest viewport this whole suite rests on', () => {
  it('reports the 750dp window that keeps every behavioural suite at scale 1', () => {
    // jest-expo's DeviceInfo mock reports a 750dp window, so `themeFor` clamps to the artboard
    // width and hands back the unscaled tokens. All 38 behavioural suites silently depend on
    // that. If a preset bump ever changes it, every screen's geometry shifts at once — fail
    // here, loudly, instead of there.
    expect(Dimensions.get('window').width).toBe(750);
    expect(themeFor('light', Dimensions.get('window').width)).toBe(lightTheme);
  });
});

describe('themeFor — identity at the design width', () => {
  it('hands back the raw artboard values at 520', () => {
    const theme = themeFor('light', DESIGN);
    expect(theme.scale).toBe(1);
    expect({ ...theme.spacing }).toEqual({ ...spacing });
    expect({ ...theme.radii }).toEqual({ ...radii });
    expect({ ...theme.sizes }).toEqual({ ...sizes });

    // Type is anchored on two artboards now, so "raw" means the 520 anchor specifically.
    for (const [name, anchors] of Object.entries(typography)) {
      const role = theme.typography[name as TypographyRole];
      expect(role.fontFamily).toBe(anchors.fontFamily);
      expect(role.fontSize).toBeCloseTo(anchors.at520.fontSize, 9);
      expect(role.letterSpacing).toBeCloseTo(anchors.at520.letterSpacing, 9);
      // Same half-pixel grid as the 390 assertion below. It used to be exact here only
      // because every 520 leading happened to land on the grid already; the Home roles
      // derive theirs from a 390 measurement, so some do not. The rounding belongs to
      // `scaleTheme`, not to the anchor.
      expect(role.lineHeight ?? 0).toBeGreaterThanOrEqual(anchors.at520.lineHeight);
      expect(role.lineHeight ?? 0).toBeLessThan(anchors.at520.lineHeight + 0.5);
    }
  });

  it('treats any screen wider than the artboard as the artboard', () => {
    expect(themeFor('light', 700)).toBe(lightTheme);
    expect(themeFor('dark', 1024)).toBe(darkTheme);
  });
});

describe('themeFor — proportionality', () => {
  const theme = themeFor('light', IPHONE_14);

  it('scales every spacing step by exactly width/520', () => {
    for (const [key, raw] of Object.entries(spacing)) {
      expect(theme.spacing[key as keyof typeof spacing]).toBeCloseTo(raw * K, 9);
    }
  });

  it('scales every size by exactly width/520, bar the documented exemptions', () => {
    for (const [key, raw] of Object.entries(sizes)) {
      const scaled = theme.sizes[key as keyof typeof sizes];
      if (key === 'designWidth' || key === 'minHitTarget') expect(scaled).toBe(raw);
      else expect(scaled).toBeCloseTo(raw * K, 9);
    }
  });

  it('scales every radius by exactly width/520, bar the pill sentinel', () => {
    for (const [key, raw] of Object.entries(radii)) {
      const scaled = theme.radii[key as keyof typeof radii];
      if (key === 'full') expect(scaled).toBe(raw);
      else expect(scaled).toBeCloseTo(raw * K, 9);
    }
  });

  it('lands every role on its Mobile 2 measurement at 390', () => {
    // Type does not follow `K`. The 390 artboard holds the layout at exactly 0.75 and holds the
    // font sizes back, which is what keeps text legible in boxes that shrank. Each role is
    // measured on both boards; at 390 it must be the 390 measurement, to the pixel.
    for (const [role, anchors] of Object.entries(typography)) {
      const scaled = theme.typography[role as TypographyRole];
      expect(scaled.fontSize).toBeCloseTo(anchors.at390.fontSize, 9);
      expect(scaled.letterSpacing).toBeCloseTo(anchors.at390.letterSpacing, 9);
      // Line heights land on a half-pixel to keep Android baselines steady.
      expect(scaled.lineHeight).toBeGreaterThanOrEqual(anchors.at390.lineHeight);
      expect(scaled.lineHeight).toBeLessThan(anchors.at390.lineHeight + 0.5);
    }
  });

  it('scales leading by exactly width/520, the way geometry does', () => {
    // Only the font *size* was held back. Leading scaled with the layout, which is how the
    // glyphs grow into their line boxes instead of pushing the layout apart.
    //
    // There are no exemptions left. The two that used to be here — the Home tile labels,
    // which pinned their own leading — were re-measured on 210:262 and derive their 520
    // anchor from the 390 one, which puts them back on this line by construction.
    for (const anchors of Object.values(typography)) {
      expect(anchors.at390.lineHeight).toBeCloseTo(anchors.at520.lineHeight * K, 9);
      expect(anchors.at390.letterSpacing).toBeCloseTo(anchors.at520.letterSpacing * K, 9);
    }
  });

  it('keeps text sitting inside its line box after rounding', () => {
    for (const width of [320, 360, IPHONE_14, 430, DESIGN]) {
      const { typography: scaled } = themeFor('light', width);
      for (const role of Object.keys(typography) as TypographyRole[]) {
        expect(scaled[role].lineHeight ?? 0).toBeGreaterThanOrEqual(scaled[role].fontSize ?? 0);
      }
    }
  });

  it('lets type outrun the box by exactly as much as Mobile 2 does', () => {
    // The 520 board puts body at 15 against a 24 gutter. Mobile 2 puts it at 13 against 18 —
    // deliberately looser, and that gap *is* the readability. Pin the artboard ratio, not a
    // hand-picked bias, so the day the boards change this fails rather than drifts.
    expect((theme.typography.body.fontSize ?? 0) / theme.spacing.gutter).toBeCloseTo(13 / 18, 9);
    expect(themeFor('light', DESIGN).typography.body.fontSize).toBeCloseTo(15, 9);
  });
});

describe('themeFor — numeric soundness across every device width', () => {
  const WIDTHS = [320, 360, 375, 390, 393, 412, 414, 428, 430, DESIGN, 700, 1024];

  it('never produces a NaN, an infinity or a negative length', () => {
    for (const width of WIDTHS) {
      const theme = themeFor('light', width);
      const lengths = [
        ...Object.values(theme.spacing),
        ...Object.values(theme.radii),
        ...Object.values(theme.sizes),
        ...Object.values(theme.typography).flatMap((role) => [
          role.fontSize ?? 0,
          role.lineHeight ?? 0,
        ]),
        theme.scale,
        theme.contentWidth,
      ];
      for (const value of lengths) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('shrinks monotonically as the screen narrows, and holds type at the narrow board', () => {
    const widths = [320, 360, IPHONE_14, 430, DESIGN];
    const bodySizes = widths.map((w) => themeFor('light', w).typography.body.fontSize ?? 0);
    const gutters = widths.map((w) => themeFor('light', w).spacing.gutter);

    for (let i = 1; i < widths.length; i += 1) {
      // Geometry never stops shrinking; type stops at 390, so it may repeat but never reverse.
      expect(gutters[i]).toBeGreaterThan(gutters[i - 1] as number);
      expect(bodySizes[i]).toBeGreaterThanOrEqual(bodySizes[i - 1] as number);
    }

    // The flat range is the point of the floor, so assert it rather than merely allowing it.
    expect(bodySizes[0]).toBe(bodySizes[1]);
    expect(bodySizes[1]).toBe(bodySizes[2]);
    expect(bodySizes[4]).toBeGreaterThan(bodySizes[2] as number);
  });
});

describe('themeFor — what must not scale', () => {
  const theme = themeFor('light', IPHONE_14);

  it('leaves non-length token groups identical to the raw exports', () => {
    expect(theme.opacity).toBe(lightTheme.opacity);
    expect(theme.zIndex).toBe(lightTheme.zIndex);
    expect(theme.motion).toBe(lightTheme.motion);
    expect(theme.fontFamily).toBe(lightTheme.fontFamily);
    expect(theme.colors).toBe(lightTheme.colors);
  });

  it('keeps the ergonomic tap-target floor and the artboard divisor fixed', () => {
    expect(theme.sizes.minHitTarget).toBe(44);
    expect(theme.sizes.designWidth).toBe(DESIGN);
  });
});

describe('themeFor — caching', () => {
  it('returns one stable instance per scheme and width', () => {
    expect(themeFor('light', IPHONE_14)).toBe(themeFor('light', IPHONE_14));
    expect(themeFor('light', 390.4)).toBe(themeFor('light', IPHONE_14));
    expect(themeFor('light', IPHONE_14)).not.toBe(lightTheme);
    expect(themeFor('dark', IPHONE_14)).not.toBe(themeFor('light', IPHONE_14));
  });
});

describe('buildShadows', () => {
  it('scales offsets and blur but never alpha or elevation', () => {
    const raw = buildShadows(1);
    const scaled = buildShadows(K);

    for (const key of Object.keys(shadowSpecs) as (keyof typeof shadowSpecs)[]) {
      if (scaled[key].elevation !== undefined) {
        // Android: elevation is a z-ordering depth, not a proportion — shrinking it reorders
        // siblings, so it is deliberately left alone and the styles match exactly.
        expect(scaled[key]).toEqual(raw[key]);
        continue;
      }
      const { x, y, blur, alpha } = shadowSpecs[key];
      expect(scaled[key].boxShadow).toBe(
        `${x * K}px ${y * K}px ${blur * K}px rgba(0, 0, 0, ${alpha})`,
      );
    }
  });

  it('keeps `none` empty at every scale', () => {
    expect(buildShadows(K).none).toEqual({});
  });
});
