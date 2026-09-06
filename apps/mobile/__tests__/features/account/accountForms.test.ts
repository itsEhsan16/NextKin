import {
  emptyPasswordDraft,
  looksLikeEmail,
  PASSWORD_MIN,
  sameAddress,
  validateNewEmail,
  validatePasswordChange,
} from '@/features/account/accountForms';

/** The account on the fixture; every email case is judged against it. */
const CURRENT = 'george.mathew@example.com';

const errorsOf = (result: ReturnType<typeof validateNewEmail>): Record<string, string> =>
  result.ok ? {} : result.errors;

describe('accountForms — email (V2 §7.1)', () => {
  it('accepts an address that differs from the one on the account', () => {
    expect(validateNewEmail('george@nextkin.app', CURRENT)).toEqual({ ok: true });
    // Surrounding space is the reader's, not the address's.
    expect(validateNewEmail('  george@nextkin.app  ', CURRENT)).toEqual({ ok: true });
  });

  it('says what is missing rather than "invalid"', () => {
    expect(errorsOf(validateNewEmail('', CURRENT)).email).toBe('Add the address you want to use.');
    expect(errorsOf(validateNewEmail('   ', CURRENT)).email).toBe(
      'Add the address you want to use.',
    );
    expect(errorsOf(validateNewEmail('george', CURRENT)).email).toBe(
      "That doesn't look like an email address.",
    );
    expect(errorsOf(validateNewEmail('george@nextkin', CURRENT)).email).toBe(
      "That doesn't look like an email address.",
    );
  });

  /**
   * The one rule that is about the product rather than the format: sending yourself a
   * verification for the address you already have would look like it worked and change nothing.
   */
  it('refuses the address the account already has, whatever the casing', () => {
    expect(errorsOf(validateNewEmail(CURRENT, CURRENT)).email).toBe('That is already your address.');
    expect(errorsOf(validateNewEmail(CURRENT.toUpperCase(), CURRENT)).email).toBe(
      'That is already your address.',
    );
  });

  it('compares addresses the way they are delivered', () => {
    expect(sameAddress(' A@B.com ', 'a@b.COM')).toBe(true);
    expect(sameAddress('a@b.com', 'a@c.com')).toBe(false);
    expect(looksLikeEmail('a@b.co')).toBe(true);
    expect(looksLikeEmail('a b@c.com')).toBe(false);
  });
});

describe('accountForms — password (V2 §7.1, §8.4)', () => {
  const draft = (over: Partial<ReturnType<typeof emptyPasswordDraft>> = {}) => ({
    ...emptyPasswordDraft(),
    ...over,
  });

  it('accepts a long enough new password typed the same way twice', () => {
    expect(
      validatePasswordChange(draft({ current: 'old-one-here', next: 'new-one-here', confirm: 'new-one-here' })),
    ).toEqual({ ok: true });
  });

  it('names every empty box rather than only the first', () => {
    const result = validatePasswordChange(draft());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(['confirm', 'current', 'next']);
  });

  it('enforces the published minimum, and quotes it', () => {
    const result = validatePasswordChange(
      draft({ current: 'old-one-here', next: 'short', confirm: 'short' }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.next).toBe(`Use at least ${PASSWORD_MIN} characters.`);
  });

  it('refuses the password already in use, and a mismatched confirmation', () => {
    const same = validatePasswordChange(
      draft({ current: 'same-password', next: 'same-password', confirm: 'same-password' }),
    );
    expect(same.ok).toBe(false);
    if (!same.ok) expect(same.errors.next).toBe('That is the password you already use.');

    const mismatch = validatePasswordChange(
      draft({ current: 'old-one-here', next: 'new-one-here', confirm: 'new-one-heer' }),
    );
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.errors.confirm).toBe("The two new passwords don't match.");
  });

  /**
   * §8.4 draws the line: only the identity provider holds the password, so a leading or trailing
   * space is a legal part of one and trimming it here would send something the reader never typed.
   */
  it('never trims a password', () => {
    expect(
      validatePasswordChange(draft({ current: 'old-one-here', next: ' padded pw ', confirm: ' padded pw ' })),
    ).toEqual({ ok: true });
    const mismatch = validatePasswordChange(
      draft({ current: 'old-one-here', next: ' padded pw ', confirm: 'padded pw' }),
    );
    expect(mismatch.ok).toBe(false);
  });
});
