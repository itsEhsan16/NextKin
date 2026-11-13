import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cn, THEME_SCALES, TRANSITIONS, Z_LAYERS } from '@/lib/cn';
import { typography } from '@/theme/tokens';

/**
 * The board names its type roles (`text-body-m`) in the same shape Tailwind names text colours
 * (`text-text-inverse`), so tailwind-merge has to be told which is which. Left to guess, it
 * treated them as one group and kept only the last — which is how nav labels lost their size and
 * the primary button lost its white. These pin both directions.
 */
describe('cn', () => {
  it('keeps a type role and a text colour together', () => {
    expect(cn('text-body-m', 'text-text-inverse')).toBe('text-body-m text-text-inverse');
    expect(cn('text-caption-m text-text-brand')).toBe('text-caption-m text-text-brand');
  });

  it('still lets a later role replace an earlier one', () => {
    expect(cn('text-body-m', 'text-title-l')).toBe('text-title-l');
  });

  it('still lets a later colour replace an earlier one', () => {
    expect(cn('text-text-primary', 'text-text-brand')).toBe('text-text-brand');
  });

  it.each(Object.keys(typography))('classifies the %s role as a size, not a colour', (role) => {
    const kebab = role.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    expect(cn(`text-${kebab}`, 'text-text-tertiary')).toContain(`text-${kebab}`);
    expect(cn(`text-${kebab}`, 'text-text-tertiary')).toContain('text-text-tertiary');
  });
});

/** Redesign R8: the theme's own scale names merge like Tailwind's stock ones. */
describe('cn with the theme scales', () => {
  const css = readFileSync(join(__dirname, '../../src/theme/theme.css'), 'utf8');
  const names = (prefix: string) =>
    new Set(
      [...css.matchAll(new RegExp(String.raw`^\s*--${prefix}-([a-z0-9-]+):`, 'gm'))]
        .map((m) => m[1] as string)
        .filter((name) => !name.includes('--')),
    );

  it.each(['spacing', 'radius', 'shadow', 'tracking', 'container'] as const)(
    'names only --%s-* tokens theme.css declares',
    (scale) => {
      const declared = names(scale);
      expect(THEME_SCALES[scale].filter((name) => !declared.has(name))).toEqual([]);
    },
  );

  it('names only z-layers and transition sets theme.css declares', () => {
    const utilities = (prefix: string) =>
      new Set(
        [...css.matchAll(new RegExp(String.raw`@utility ${prefix}-([a-z-]+) \{`, 'g'))].map(
          (m) => m[1],
        ),
      );
    const z = utilities('z');
    const transitions = utilities('transition');
    expect(Z_LAYERS.filter((name) => !z.has(name))).toEqual([]);
    expect(TRANSITIONS.filter((name) => !transitions.has(name))).toEqual([]);
  });

  it("lets a caller's size replace a token default", () => {
    expect(cn('h-progress w-full', 'h-1.5')).toBe('w-full h-1.5');
    expect(cn('w-dialog-lg', 'w-full')).toBe('w-full');
    expect(cn('rounded-admin-md', 'rounded-full')).toBe('rounded-full');
    expect(cn('before:z-behind', 'before:z-10')).toBe('before:z-10');
    expect(cn('transition-field', 'transition-colors')).toBe('transition-colors');
    expect(cn('tracking-display', 'tracking-tight')).toBe('tracking-tight');
  });
});
