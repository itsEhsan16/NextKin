import {
  colorsByScheme,
  durations,
  fontFamily,
  radii,
  scales,
  spacing,
  springs,
  stagger,
  timings,
  typography,
  type ColorScheme,
} from '@/theme';

const HEX_COLOR = /^#[0-9A-F]{6}(?:[0-9A-F]{2})?$/i;
const RGBA_COLOR =
  /^rgba\(\s*(?:\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\s*,\s*(?:\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\s*,\s*(?:\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\s*,\s*(?:0|1|0?\.\d+)\s*\)$/;

const schemes: ColorScheme[] = ['light', 'dark'];
const lightKeys = Object.keys(colorsByScheme.light).sort();
const darkKeys = Object.keys(colorsByScheme.dark).sort();

describe('colorsByScheme', () => {
  it('exposes exactly the two supported schemes', () => {
    expect(Object.keys(colorsByScheme).sort()).toEqual(['dark', 'light']);
  });

  it('defines every light colour key in the dark scheme', () => {
    const missingInDark = lightKeys.filter((key) => !(key in colorsByScheme.dark));
    expect(missingInDark).toEqual([]);
  });

  it('defines every dark colour key in the light scheme', () => {
    const missingInLight = darkKeys.filter((key) => !(key in colorsByScheme.light));
    expect(missingInLight).toEqual([]);
  });

  it('has identical key sets across schemes', () => {
    expect(darkKeys).toEqual(lightKeys);
    expect(lightKeys.length).toBeGreaterThan(0);
  });

  it.each(schemes)('uses only hex or rgba() values in the %s scheme', (scheme) => {
    const offenders = Object.entries(colorsByScheme[scheme]).filter(
      ([, value]) => !(HEX_COLOR.test(value) || RGBA_COLOR.test(value)),
    );
    expect(offenders).toEqual([]);
  });

  it.each(schemes)('keeps the %s scrim translucent', (scheme) => {
    expect(colorsByScheme[scheme].scrim).toMatch(RGBA_COLOR);
  });

  it('gives the two schemes different page surfaces', () => {
    expect(colorsByScheme.light.surfacePage).not.toBe(colorsByScheme.dark.surfacePage);
    expect(colorsByScheme.light.textPrimary).not.toBe(colorsByScheme.dark.textPrimary);
  });
});

describe('typography', () => {
  const families = Object.values(fontFamily) as string[];
  const roles = Object.entries(typography);

  it('registers four Plus Jakarta Sans weights', () => {
    expect(families).toHaveLength(4);
    for (const family of families) expect(family).toMatch(/^PlusJakartaSans_\d{3}\w+$/);
  });

  it('has at least one text role', () => {
    expect(roles.length).toBeGreaterThan(0);
  });

  it.each(roles)('role "%s" uses a Plus Jakarta Sans family', (_name, role) => {
    expect(typeof role.fontFamily).toBe('string');
    expect(role.fontFamily).toMatch(/^PlusJakartaSans_/);
    expect(families).toContain(role.fontFamily);
  });

  it.each(roles)('role "%s" has a lineHeight no smaller than its fontSize', (_name, role) => {
    expect(role.fontSize).toBeGreaterThan(0);
    expect(role.lineHeight).toBeGreaterThanOrEqual(role.fontSize ?? 0);
  });

  it.each(roles)('role "%s" has a finite letterSpacing', (_name, role) => {
    expect(Number.isFinite(role.letterSpacing)).toBe(true);
  });
});

describe('motion', () => {
  const springEntries = Object.entries(springs);
  const timingEntries = Object.entries(timings);

  it.each(springEntries)('spring "%s" has a dampingRatio in (0, 1]', (_name, config) => {
    expect(config.dampingRatio).toBeGreaterThan(0);
    expect(config.dampingRatio).toBeLessThanOrEqual(1);
  });

  it.each(springEntries)('spring "%s" has a positive duration', (_name, config) => {
    expect(config.duration).toBeGreaterThan(0);
  });

  it.each(timingEntries)('timing "%s" has a positive duration and an easing', (_name, config) => {
    expect(config.duration).toBeGreaterThan(0);
    expect(config.easing).toBeDefined();
  });

  it('keeps every named duration positive except "instant"', () => {
    const { instant, ...rest } = durations;
    expect(instant).toBe(0);
    for (const value of Object.values(rest)) expect(value).toBeGreaterThan(0);
  });

  it('matches the Figma sheet annotation (300ms in, 200ms out, 0.8 damping)', () => {
    expect(springs.sheetIn.duration).toBe(300);
    expect(springs.sheetIn.dampingRatio).toBe(0.8);
    expect(timings.sheetOut.duration).toBe(200);
    expect(timings.sheetOut.duration).toBeLessThan(springs.sheetIn.duration);
  });

  it('uses positive stagger delays with an integer item cap', () => {
    expect(stagger.row).toBeGreaterThan(0);
    expect(stagger.card).toBeGreaterThan(0);
    expect(Number.isInteger(stagger.maxItems)).toBe(true);
    expect(stagger.maxItems).toBeGreaterThan(0);
  });

  it('keeps press/exit scales strictly inside (0, 1)', () => {
    for (const value of Object.values(scales)) {
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('layout tokens', () => {
  it('keeps the spacing scale on a 4-pt grid', () => {
    for (const value of Object.values(spacing)) expect(value % 4).toBe(0);
    expect(spacing.gutter).toBe(24);
  });

  it('keeps numeric spacing steps strictly ascending', () => {
    const steps = Object.entries(spacing)
      .filter(([key]) => /^\d+$/.test(key))
      .map(([key, value]) => [Number(key), value] as const)
      .sort((a, b) => a[0] - b[0])
      .map(([, value]) => value);
    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i]).toBeGreaterThan(steps[i - 1] ?? Number.NEGATIVE_INFINITY);
    }
  });

  it('uses non-negative radii with "full" as the largest', () => {
    const values = Object.values(radii);
    for (const value of values) expect(value).toBeGreaterThanOrEqual(0);
    expect(radii.full).toBe(Math.max(...values));
  });
});
