import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as menuMotion from '@/ui/menuMotion';
import * as pressable from '@/ui/pressable';

/**
 * Tailwind generates CSS only for class names it finds written out in the source, so every
 * motion class string has to appear whole, as one literal, in the file that exports it. One
 * assembled at runtime gets no CSS, and the motion silently disappears (the `navRowMotion` lesson,
 * `toreview.md` §11).
 */
const source = (file: string) => readFileSync(join(__dirname, '../../src/ui', file), 'utf8');

describe('motion class strings', () => {
  it.each([
    ['menuMotion.ts', menuMotion],
    ['pressable.ts', pressable],
  ] as const)('%s writes every class string out whole', (file, exports) => {
    const text = source(file);
    for (const value of Object.values(exports)) {
      expect(text).toContain(`'${value}'`);
    }
  });

  it('times everything on the motion tokens', () => {
    for (const value of [...Object.values(menuMotion), ...Object.values(pressable)]) {
      expect(value).not.toMatch(/duration-\[|\d+ms/);
    }
    expect(pressable.pressable).toContain('duration-press');
    expect(pressable.pressable).toContain('scale-(--scale-pressed)');
  });

  it('never presses or hovers a disabled button', () => {
    expect(pressable.pressable).toMatch(/not-disabled:not-aria-disabled:active:/);
  });
});
