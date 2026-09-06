import type { Profile, User } from '@/data/models';
import {
  citySuggestions,
  detailsChanged,
  HEADLINE_MAX,
  identityDirty,
  identityDraft,
  MAX_YEARS,
  nameChanged,
  namePatch,
  profilePatch,
  validateIdentity,
  yearsValue,
  type IdentityDraft,
} from '@/features/profile/identityForm';

const user = {
  id: 'usr_1',
  email: 'george.smith@example.com',
  firstName: 'George',
  lastName: 'Smith',
  createdAt: '2024-01-01T00:00:00.000Z',
} as User;

const profile = {
  userId: 'usr_1',
  headline: 'Senior UX Designer',
  location: 'Bengaluru',
  yearsExperience: 8,
} as Profile;

const base = (): IdentityDraft => identityDraft(user, profile);
const errorsOf = (draft: IdentityDraft): Record<string, string> => {
  const result = validateIdentity(draft);
  return result.ok ? {} : result.errors;
};

describe('identityDraft', () => {
  it('reads the name off the user and the three fields off the profile', () => {
    expect(base()).toEqual({
      firstName: 'George',
      lastName: 'Smith',
      headline: 'Senior UX Designer',
      location: 'Bengaluru',
      yearsExperience: '8',
    });
  });

  it('starts an unfilled profile at blank rather than at zero', () => {
    expect(identityDraft(user, { userId: 'usr_1' } as Profile)).toMatchObject({
      headline: '',
      location: '',
      yearsExperience: '',
    });
  });
});

describe('validateIdentity', () => {
  it('accepts the loaded profile', () => {
    expect(validateIdentity(base())).toEqual({ ok: true });
  });

  it('requires both halves of a name', () => {
    const errors = errorsOf({ ...base(), firstName: '   ', lastName: '' });
    expect(errors.firstName).toBe('Enter your first name.');
    expect(errors.lastName).toBe('Enter your last name.');
  });

  it('refuses a headline longer than the cap and says how long it is', () => {
    const headline = 'x'.repeat(HEADLINE_MAX + 4);
    expect(errorsOf({ ...base(), headline }).headline).toBe(
      `That is ${HEADLINE_MAX + 4} characters. Keep it under ${HEADLINE_MAX}.`,
    );
  });

  it('leaves the optional fields alone when they are blank', () => {
    expect(
      validateIdentity({ ...base(), headline: '', location: '', yearsExperience: '' }),
    ).toEqual({ ok: true });
  });

  it('takes whole years only, inside a range a career fits in', () => {
    expect(errorsOf({ ...base(), yearsExperience: '8.5' }).yearsExperience).toBe(
      'Use a whole number of years.',
    );
    expect(errorsOf({ ...base(), yearsExperience: 'eight' }).yearsExperience).toBe(
      'Use a whole number of years.',
    );
    expect(errorsOf({ ...base(), yearsExperience: '200' }).yearsExperience).toBe(
      `Enter a number between 0 and ${MAX_YEARS}.`,
    );
    expect(validateIdentity({ ...base(), yearsExperience: '0' })).toEqual({ ok: true });
    expect(validateIdentity({ ...base(), yearsExperience: String(MAX_YEARS) })).toEqual({
      ok: true,
    });
  });
});

describe('the dirty test', () => {
  it('does not call unchanged input an edit', () => {
    expect(identityDirty(base(), base())).toBe(false);
  });

  it('does not call whitespace an edit, on either half', () => {
    const padded: IdentityDraft = {
      firstName: ' George ',
      lastName: 'Smith  ',
      headline: '  Senior UX Designer',
      location: ' Bengaluru ',
      yearsExperience: ' 8 ',
    };
    expect(nameChanged(padded, base())).toBe(false);
    expect(detailsChanged(padded, base())).toBe(false);
    expect(identityDirty(padded, base())).toBe(false);
  });

  it('reads eight years the same however it is spelled', () => {
    expect(detailsChanged({ ...base(), yearsExperience: '08' }, base())).toBe(false);
    expect(detailsChanged({ ...base(), yearsExperience: '9' }, base())).toBe(true);
  });

  it('separates the two aggregates, so one edit never writes both', () => {
    const headlineOnly = { ...base(), headline: 'Staff Product Designer' };
    expect(nameChanged(headlineOnly, base())).toBe(false);
    expect(detailsChanged(headlineOnly, base())).toBe(true);

    const nameOnly = { ...base(), lastName: 'Smyth' };
    expect(nameChanged(nameOnly, base())).toBe(true);
    expect(detailsChanged(nameOnly, base())).toBe(false);
  });
});

describe('what leaves the form', () => {
  it('trims the name it sends', () => {
    expect(namePatch({ ...base(), firstName: '  Georgina ', lastName: ' Smith ' })).toEqual({
      firstName: 'Georgina',
      lastName: 'Smith',
    });
  });

  it('clears a field with undefined rather than with an empty string', () => {
    expect(profilePatch({ ...base(), headline: '   ', location: '', yearsExperience: '' })).toEqual(
      { headline: undefined, location: undefined, yearsExperience: undefined },
    );
  });

  it('sends the trimmed values and the parsed years', () => {
    expect(profilePatch({ ...base(), headline: ' Staff Designer ' })).toEqual({
      headline: 'Staff Designer',
      location: 'Bengaluru',
      yearsExperience: 8,
    });
  });

  it('parses the years field on its own', () => {
    expect(yearsValue('')).toBeUndefined();
    expect(yearsValue('  ')).toBeUndefined();
    expect(yearsValue('12')).toBe(12);
    expect(yearsValue('nope')).toBeUndefined();
  });
});

describe('citySuggestions', () => {
  it('offers nothing until something has been typed', () => {
    expect(citySuggestions('')).toEqual([]);
    expect(citySuggestions('   ')).toEqual([]);
  });

  it('matches case-insensitively, anywhere in the name', () => {
    expect(citySuggestions('beng')).toEqual(['Bengaluru']);
    expect(citySuggestions('DEL')).toEqual(['Delhi NCR']);
    expect(citySuggestions('a')).toHaveLength(4);
  });

  it('stops offering a city the field already says', () => {
    expect(citySuggestions('Bengaluru')).toEqual([]);
    expect(citySuggestions('bengaluru')).toEqual([]);
  });

  it('offers nothing for a city it does not know', () => {
    expect(citySuggestions('Reykjavik')).toEqual([]);
  });
});
