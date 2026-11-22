/* global jest */
/* A Node-side source scan, in plain JS so the app's typecheck (no Node types) never sees it. */
const { readdirSync, readFileSync, statSync } = require('fs');
const { join, relative } = require('path');

/**
 * Selected text vanished under a black block on Android (owner, 2026-11-19, toreview §243):
 * Android paints `selectionColor` as the highlight at full strength. Every input takes its
 * colours from `useSelectionColors`, which runs the Android branch here.
 */
jest.mock('react-native/Libraries/Utilities/Platform', () => {
  const actual = jest.requireActual('react-native/Libraries/Utilities/Platform');
  const base = actual.default ?? actual;
  return { ...base, OS: 'android', __esModule: true, default: { ...base, OS: 'android' } };
});

const { renderHook } = require('@testing-library/react-native');
const { useSelectionColors } = require('@/ui/TextField');

describe('text selection stays readable', () => {
  it('highlights in a see-through tint on Android, with brand handles', async () => {
    const { result } = await renderHook(() => useSelectionColors());
    expect(result.current.selectionColor).toMatch(/^rgba\(.+, 0\.\d+\)$/);
    expect(result.current.selectionHandleColor).toBeDefined();
  });

  it('sets selection or cursor colours nowhere but useSelectionColors', () => {
    const root = join(__dirname, '..', '..');
    const offenders = [];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name) && name !== 'useSelectionColors.ts') {
          readFileSync(path, 'utf8')
            .split('\n')
            .forEach((line, i) => {
              if (/\b(selectionColor|selectionHandleColor|cursorColor)=/.test(line))
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
