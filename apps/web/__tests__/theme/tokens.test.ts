import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { colors, controls, motion, radii, shadows, typography } from '@/theme/tokens';

/**
 * `theme.css` is what Tailwind compiles and `tokens.ts` is what TypeScript reads. Nothing forces
 * them to agree, so this does: every colour and every duration has to appear in both, with the
 * same value. A token added to one and forgotten in the other fails here rather than shipping as
 * a component that is the wrong colour only when it renders an SVG.
 */
const css = readFileSync(join(__dirname, '../../src/theme/theme.css'), 'utf8');

// `String.raw`: in a plain template literal `\s` is just `s`, so the pattern used to read
// `--name:s*(...)` and only passed because `.trim()` cleaned up the space (redesign R1).
const cssVar = (name: string): string | undefined =>
  css.match(new RegExp(String.raw`--${name}:\s*([^;]+);`))?.[1]?.trim();

describe('theme tokens', () => {
  it.each(Object.entries(colors))('%s is declared in theme.css with the same value', (key, hex) => {
    // textPrimary -> text-primary, brand600 -> brand-600, neutral0 -> neutral-0
    const kebab = key.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase();
    expect(cssVar(`color-${kebab}`)).toBe(hex);
  });

  it.each(Object.entries(motion.durations))('duration %s matches theme.css', (key, ms) => {
    // `--transition-duration-*`, not a bare `--duration-*` — that's the namespace Tailwind v4's
    // `duration-*` utility actually reads from (unlike `ease-*`, which does read a bare
    // `--ease-*`). Getting this wrong doesn't error — `var(--duration-x)` still resolves fine
    // inside an arbitrary value — it just means the `duration-*` utility class silently never
    // registers and every element using it falls back to Tailwind's own default 150ms.
    expect(cssVar(`transition-duration-${key}`)).toBe(`${ms}ms`);
  });

  it.each(Object.entries(motion.easings))('easing %s matches theme.css', (key, curve) => {
    expect(cssVar(`ease-${key}`)).toBe(curve);
  });

  /**
   * The other direction: a token declared in theme.css and never mirrored here escapes every check
   * above (display-xl, the skeleton colours and skeleton-delay did, until redesign R1).
   */
  it('mirrors every colour, duration, easing and type size theme.css declares', () => {
    const kebab = (key: string) => key.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase();
    const declared = (prefix: string) =>
      new Set(
        [...css.matchAll(new RegExp(String.raw`--${prefix}-([a-z0-9-]+):`, 'g'))]
          .map(([, name]) => name!)
          .filter((name) => !name.includes('--')),
      );
    expect([...declared('color')].sort()).toEqual(Object.keys(colors).map(kebab).sort());
    expect([...declared('transition-duration')].sort()).toEqual(
      Object.keys(motion.durations).sort(),
    );
    expect([...declared('ease')].sort()).toEqual(Object.keys(motion.easings).sort());
    // Type roles split on letters only: `h1` stays `h1`, `displayXl` becomes `display-xl`.
    const role = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    expect([...declared('text')].sort()).toEqual(Object.keys(typography).map(role).sort());
  });

  it.each(Object.entries(radii).filter(([key]) => key !== 'full'))(
    'radius %s matches theme.css',
    (key, px) => {
      expect(cssVar(`radius-${key}`)).toBe(`${px}px`);
    },
  );

  it('keeps every type role on a sane desktop scale', () => {
    for (const [role, [size, lineHeight]] of Object.entries(typography)) {
      expect(size).toBeGreaterThanOrEqual(11);
      expect(lineHeight).toBeGreaterThan(size);
      expect(
        cssVar(
          `text-${role === 'displayL' ? 'display-l' : role.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}`,
        ),
      ).toBe(`${size}px`);
    }
  });

  /**
   * Figma reports letter-spacing as a percentage of the font size — the board's "-0.8" on H2 is
   * -0.16px at 20px, not -0.8px. Storing it as px made every heading multiples too tight, so the
   * unit is pinned here: `em` is exactly "fraction of font size".
   */
  it('expresses letter-spacing as a fraction of the font size, not px', () => {
    for (const [role, [, , tracking]] of Object.entries(typography)) {
      const name =
        role === 'displayL' ? 'display-l' : role.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
      const declared = cssVar(`text-${name}--letter-spacing`);
      expect(declared).toBeDefined();
      if (tracking === 0) {
        expect(declared).toBe('0px');
      } else {
        expect(declared).toMatch(/em$/);
        expect(Number.parseFloat(declared!)).toBeCloseTo(tracking / 100, 5);
      }
    }
  });

  it.each(Object.entries(controls))('control height %s matches theme.css', (key, px) => {
    expect(cssVar(`spacing-control-${key}`)).toBe(`${px}px`);
  });

  it.each(Object.entries(shadows))('shadow %s matches theme.css', (key, value) => {
    const kebab = key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    expect(cssVar(`shadow-${kebab}`)).toBe(value);
  });

  it('presses to the same scale in both layers', () => {
    expect(cssVar('scale-pressed')).toBe(String(motion.pressedScale));
  });

  it('times every mount animation with the duration and easing tokens', () => {
    const animations = [...css.matchAll(/--animate-([a-z-]+):([^;]+);/g)];
    expect(animations.map(([, name]) => name)).toEqual([
      'reveal',
      'pop-in',
      'pop-out',
      'fade-out',
      'ring-sweep',
      'meter-grow',
      'bar-grow',
      'line-draw',
      'drawer-in',
      'float',
      'rise',
      'shimmer',
      'think',
      'sweep',
      'ring-draw',
    ]);
    for (const [, , value] of animations) {
      expect(value).toMatch(/var\(--transition-duration-[a-z]+\)/);
      expect(value).toMatch(/var\(--ease-[a-z]+\)/);
      expect(value).not.toMatch(/\d+m?s\b/);
    }
  });

  it('times the route cross-fade with tokens and stills it under reduced motion', () => {
    const pageFades = [...css.matchAll(/animation: page-(?:in|out) ([^;]+);/g)];
    expect(pageFades).toHaveLength(2);
    for (const [, value] of pageFades) expect(value).not.toMatch(/\d+m?s\b/);

    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toContain('::view-transition-group(*)');
    expect(reduced).toContain('::view-transition-new(*)');
  });
});
