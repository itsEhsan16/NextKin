import {
  emptyZeroAbout,
  fullNameOf,
  isZeroAboutReady,
  validateZeroAbout,
  zeroSeedFrom,
  type ZeroAbout,
} from '@/features/create/zeroResume';

const filled = (patch: Partial<ZeroAbout> = {}): ZeroAbout => ({
  fullName: 'George Smith',
  years: '6-10',
  role: 'Product Designer',
  ...patch,
});

describe('zeroResume — ZERO 01 "About you" (V2 §7.9)', () => {
  it('needs all three things, and says what each one is for', () => {
    expect(validateZeroAbout(emptyZeroAbout)).toEqual({
      fullName: 'Add the name you want printed on the resume.',
      years: 'Pick how long you have worked. None is a fine answer.',
      role: 'Add the role you want, like Product Designer.',
    });
    expect(isZeroAboutReady(filled())).toBe(true);
  });

  it('takes None as a real answer', () => {
    expect(validateZeroAbout(filled({ years: 'none' }))).toEqual({});
  });

  it('refuses whitespace and over-long lines', () => {
    expect(validateZeroAbout(filled({ fullName: '   ' })).fullName).toBeDefined();
    expect(validateZeroAbout(filled({ role: 'x'.repeat(81) })).role).toMatch(/under 80/);
  });

  it('seeds the run with the band and its figure, trimmed', () => {
    expect(
      zeroSeedFrom(filled({ fullName: ' George Smith ', role: ' Product Designer ' })),
    ).toEqual({
      fullName: 'George Smith',
      yearsBand: '6-10',
      yearsExperience: 8,
      targetTitle: 'Product Designer',
    });
    expect(zeroSeedFrom(filled({ years: 'none' })).yearsExperience).toBe(0);
  });

  it('prefills the name from the account, skipping empty parts', () => {
    expect(fullNameOf({ firstName: 'George', lastName: 'Smith' })).toBe('George Smith');
    expect(fullNameOf({ firstName: ' George ', lastName: '' })).toBe('George');
  });
});
