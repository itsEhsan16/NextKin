/* global jest */
/* Plain JS for the Node-side source scan, so the app's typecheck (no Node types) never sees it. */
const { readdirSync, readFileSync, statSync } = require('fs');
const { join, relative } = require('path');

/**
 * The grey frames behind fading cards (owner, 2026-11-09 §209; back again 2026-11-19 §241).
 *
 * Android paints an `elevation` shadow outside the view's own alpha, so a card that fades in
 * shows a solid grey slab around a pale inset. Cards, tiles and pills therefore take a CSS
 * `boxShadow`, which fades with them. This suite runs the Android branch on purpose (jest-expo
 * defaults to iOS, where every shadow is CSS anyway).
 */
jest.mock('react-native/Libraries/Utilities/Platform', () => {
  const actual = jest.requireActual('react-native/Libraries/Utilities/Platform');
  const base = actual.default ?? actual;
  return { ...base, OS: 'android', __esModule: true, default: { ...base, OS: 'android' } };
});

// Required after the Platform mock above, so the theme builds its Android branch.
const { themeFor } = require('@/theme');
const { ELEVATION_SHADOWS, shadowSpecs } = require('@/theme/tokens');

describe('Android shadows never draw a grey frame behind a fading card', () => {
  it('keeps elevation only for the named floating chrome', () => {
    expect([...ELEVATION_SHADOWS].sort()).toEqual(
      ['dialog', 'fab', 'sheet', 'stickyBarUp', 'toast'].sort(),
    );
  });

  it('draws every other shadow token as CSS, with no elevation', () => {
    const { shadows } = themeFor('light', 390);
    for (const key of Object.keys(shadowSpecs)) {
      const style = shadows[key];
      if (ELEVATION_SHADOWS.has(key)) {
        expect({ key, elevation: style.elevation }).toEqual({ key, elevation: expect.any(Number) });
      } else {
        expect({ key, elevation: style.elevation }).toEqual({ key, elevation: undefined });
        expect({ key, css: typeof style.boxShadow }).toEqual({ key, css: 'string' });
      }
    }
  });

  it('has no hand-written elevation anywhere outside the theme', () => {
    const root = join(__dirname, '..', '..');
    const offenders = [];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name) && !path.endsWith(join('theme', 'tokens.ts'))) {
          readFileSync(path, 'utf8')
            .split('\n')
            .forEach((line, i) => {
              if (/^\s*elevation\s*:/.test(line))
                offenders.push(`${relative(root, path)}:${i + 1}`);
            });
        }
      }
    };
    walk(join(root, 'src'));
    walk(join(root, 'app'));
    expect(offenders).toEqual([]);
  });
});
