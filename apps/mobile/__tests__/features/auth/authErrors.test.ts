import {
  CODE_WRONG,
  codeComplete,
  CONFIRM_FIRST,
  confirmErrorMessage,
  SIGN_IN_FAILED,
  signInErrorMessage,
  signUpErrorMessage,
  TOO_MANY_TRIES,
} from '@/features/auth/authForms';

/** The backend's refusals, said in the sign-in screens' voice (P5-08). */
describe('auth error copy', () => {
  it('a wrong password and an unknown email read the same', () => {
    expect(signInErrorMessage({ code: 'UNAUTHENTICATED', message: 'Sign in to continue.' })).toBe(
      SIGN_IN_FAILED,
    );
  });

  it('an unconfirmed account is told to confirm; rate limits say wait', () => {
    expect(signInErrorMessage({ code: 'FORBIDDEN', details: { notConfirmed: true } })).toBe(
      CONFIRM_FIRST,
    );
    expect(signInErrorMessage({ code: 'RATE_LIMITED' })).toBe(TOO_MANY_TRIES);
  });

  it("a network failure keeps the client's own message; anything else is a plain retry", () => {
    expect(signInErrorMessage({ code: 'NETWORK', message: 'Could not reach NextKin.' })).toBe(
      'Could not reach NextKin.',
    );
    expect(signInErrorMessage(new Error('boom'))).toMatch(/Try again/);
    expect(signInErrorMessage(undefined)).toMatch(/Try again/);
  });

  it('sign-up names the field the server refused', () => {
    expect(
      signUpErrorMessage({ code: 'VALIDATION_FAILED', details: { password: 'too_common' } }),
    ).toMatch(/password/);
    expect(
      signUpErrorMessage({ code: 'VALIDATION_FAILED', details: { email: 'invalid' } }),
    ).toMatch(/email/);
  });

  it('a wrong or expired code says so', () => {
    expect(confirmErrorMessage({ code: 'VALIDATION_FAILED', details: { code: 'invalid' } })).toBe(
      CODE_WRONG,
    );
  });

  it('a code is exactly six digits', () => {
    expect(['123456', ' 123456 ', '12345', '1234567', '12a456'].map(codeComplete)).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
  });
});
