import { cn } from '@/lib/cn';
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
