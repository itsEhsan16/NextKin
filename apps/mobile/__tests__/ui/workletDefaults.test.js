/* A Node-side source scan, in plain JS so the app's typecheck (no Node types) never sees it. */
const { readdirSync, readFileSync, statSync } = require('fs');
const { join } = require('path');

const { FOLLOW_END_SLOP, isAtEnd } = require('@/ui/Screen/scrollMath');

/**
 * The worklets plugin copies onto the UI thread only what a worklet's body references, never a
 * parameter default. `isAtEnd(event, slop = FOLLOW_END_SLOP)` therefore threw a ReferenceError on
 * the UI thread at the first scroll, which killed Expo Go on Android with no red screen
 * (toreview §138.7). Jest runs worklets as plain JS, where the constant is in scope, so only a
 * source scan can catch the pattern: a worklet's parameter default must be a literal.
 */
const SRC = join(__dirname, '..', '..', 'src');

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

// A function head, then 'worklet' as the first statement of its body.
const WORKLET = /function\s+\w*\s*\(([^)]*)\)[^{]*\{\s*'worklet'/g;
// A default (not an arrow `=>`) that is not a number, string, boolean, null, undefined or empty
// object/array literal: those are built inside the function, so nothing has to be captured.
const NON_LITERAL_DEFAULT =
  /=(?!>)(?!\s*(?:-?\d|'|"|true\b|false\b|null\b|undefined\b|\{\s*\}|\[\s*\]))/;

describe('worklet parameter defaults', () => {
  it('are literals in every worklet under src/', () => {
    const offenders = sourceFiles(SRC).flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(WORKLET)]
        .filter((match) => NON_LITERAL_DEFAULT.test(match[1] ?? ''))
        .map((match) => `${file}: ${match[0].split('{')[0].trim()}`),
    );
    expect(offenders).toEqual([]);
  });

  it('isAtEnd still falls back to FOLLOW_END_SLOP', () => {
    const metrics = (y) => ({
      contentOffset: { y },
      layoutMeasurement: { height: 500 },
      contentSize: { height: 1000 },
    });
    expect(isAtEnd(metrics(500 - FOLLOW_END_SLOP))).toBe(true);
    expect(isAtEnd(metrics(500 - FOLLOW_END_SLOP - 1))).toBe(false);
    expect(isAtEnd(metrics(490), 5)).toBe(false);
  });
});
