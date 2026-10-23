import { hash, verify } from '@node-rs/argon2';

/**
 * Password policy and hashing for the local identity provider (ImBackendImplementationPlan P4-02).
 * The policy follows NIST SP 800-63B: length matters, composition rules do not, and passwords that
 * are known to be common are refused. X-07 configures the Cognito pool to the same rule, so moving
 * to Cognito does not change what a user may choose.
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

// A short list of the most common passwords. Cognito's compromised-credentials check covers the
// long tail in production (Plus tier) [verify]; locally this keeps the obvious ones out.
const COMMON = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890', 'qwerty123', 'qwertyuiop',
  'iloveyou', 'admin123', 'welcome1', 'letmein1', 'abc12345', '11111111', '00000000', 'passw0rd', 'football',
  'baseball', 'sunshine', 'princess', 'starwars', 'trustno1', 'whatever', 'nextkin1', 'nextkin123',
]);

export type PasswordProblem = 'too_short' | 'too_long' | 'too_common' | 'contains_email';

export function passwordProblem(password: string, email: string): PasswordProblem | null {
  if (password.length < PASSWORD_MIN) return 'too_short';
  if (password.length > PASSWORD_MAX) return 'too_long';
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return 'too_common';
  const local = email.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) return 'contains_email';
  return null;
}

/** argon2id with the library's defaults (memory-hard; OWASP-recommended parameters). */
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(hashed: string | null, password: string): Promise<boolean> {
  if (!hashed) return false;
  try {
    return await verify(hashed, password);
  } catch {
    return false;
  }
}

// A real hash to compare against when the account does not exist, so a sign-in for an unknown
// email takes as long as one for a known email (no timing side channel on account existence).
let dummyHash: Promise<string> | null = null;
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hash('dummy-password-for-timing-equalisation');
  await verify(await dummyHash, password).catch(() => false);
  return false;
}
