/**
 * The IdentityProvider port (ImBackendImplementationPlan P4-01, M0-31). Cognito is production
 * identity (spec §9.4.1); the local adapter stands in for it until X-07 and is refused in staging
 * and production (L3). Shapes follow Cognito: a stable `sub`, groups as roles, access tokens of 60
 * minutes, a 30-day refresh token with rotation, and two pools (users, admins with MFA).
 *
 * One contract suite (test/contracts/identity.test.ts) runs against every adapter that exists, so
 * a pass on the local adapter means something about Cognito.
 */

export type Pool = 'users' | 'admins';
export type FederatedProvider = 'google' | 'apple';
export type ClientKind = 'web' | 'mobile';

export interface IdentityProfile {
  sub: string;
  pool: Pool;
  email: string;
  emailVerified: boolean;
  name: string | null;
  /** Cognito groups; in the admins pool these are the staff roles. */
  groups: string[];
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  /** The provider's id for this sign-in session. The server's session record is keyed by it. */
  sessionRef: string;
}

export interface AuthResult {
  profile: IdentityProfile;
  tokens: TokenSet;
}

export interface FederatedStart {
  state: string;
  nonce: string;
  codeChallenge: string;
  redirectUri: string;
}

export interface FederatedComplete {
  code: string;
  codeVerifier: string;
  nonce: string;
  redirectUri: string;
  /** Apple posts the user's name only on the very first authorization (form_post `user`). */
  appleUser?: { name?: { firstName?: string; lastName?: string } } | null;
}

export interface VerifiedAccessToken {
  sub: string;
  pool: Pool;
  sessionRef: string;
  groups: string[];
  clientId: string;
}

export type AuthFailure =
  | 'invalid_credentials'
  | 'not_confirmed'
  | 'mfa_required'
  | 'code_invalid'
  | 'weak_password'
  | 'token_invalid'
  | 'token_reused'
  | 'federation_failed'
  /** Unlinking would leave the account with no way to sign in. */
  | 'last_sign_in_method';

export class AuthError extends Error {
  constructor(
    public readonly failure: AuthFailure,
    message?: string,
    /** For token_reused: the session (token family) that was revoked, so the server ends it too. */
    public readonly sessionRef?: string,
  ) {
    super(message ?? failure);
    this.name = 'AuthError';
  }
}

export interface IdentityProvider {
  /**
   * Starts a sign-up and emails a code. Answers the same whether or not the email already has an
   * account ("prevent user existence errors"); an existing owner gets a heads-up email instead.
   */
  signUp(input: { email: string; password: string; name?: string }): Promise<void>;
  confirmSignUp(email: string, code: string): Promise<void>;
  resendCode(email: string): Promise<void>;

  /** Password sign-in. The admins pool also requires a TOTP code. */
  signIn(input: { email: string; password: string; pool: Pool; totp?: string; clientId: string }): Promise<AuthResult>;

  /** Where to send the browser for Google or Apple (Authorization Code + PKCE). */
  federatedAuthorizeUrl(provider: FederatedProvider, start: FederatedStart): string;
  /** Exchanges the code, verifies the ID token and nonce, links by verified email. */
  completeFederated(provider: FederatedProvider, input: FederatedComplete, clientId: string): Promise<AuthResult & { linked: boolean }>;

  /** Rotates the refresh token. Reusing an old one revokes the whole session (theft signal). */
  refresh(refreshToken: string): Promise<TokenSet>;
  verifyAccessToken(token: string): Promise<VerifiedAccessToken>;
  revokeSession(sessionRef: string): Promise<void>;
  globalSignOut(sub: string): Promise<void>;

  changePassword(sub: string, current: string, next: string): Promise<void>;
  /** Always answers the same; emails a code only when the account exists. */
  forgotPassword(email: string): Promise<void>;
  confirmForgotPassword(email: string, code: string, password: string): Promise<void>;

  /**
   * Starts an email change (P5-06): a code goes to the NEW address, and nothing changes until it is
   * confirmed. If the address already has an account, it gets a notice instead and no code.
   */
  requestEmailChange(sub: string, newEmail: string): Promise<void>;
  /** Applies the change; the new address is verified by the code. Returns it. */
  confirmEmailChange(sub: string, code: string): Promise<{ email: string }>;

  /** Google and Apple identities linked to the account. */
  listIdentities(sub: string): Promise<{ provider: FederatedProvider; linkedAt: string }[]>;
  /** Links a provider to a signed-in account (Settings → Connected accounts). */
  linkFederated(sub: string, provider: FederatedProvider, input: FederatedComplete): Promise<void>;
  /** Unlinks one; refused when it is the account's only way to sign in. */
  unlinkIdentity(sub: string, provider: FederatedProvider): Promise<void>;

  /**
   * Deletes the identity and everything the provider holds for it (P12-11): no sign-in works after
   * it, and the email can sign up again. Cognito: AdminDeleteUser. Idempotent.
   */
  deleteAccount(sub: string): Promise<void>;

  /** Sets a staff account's groups, its roles (§7.17: Super Admin only). Cognito: Admin(Add|Remove)UserToGroup. */
  setGroups(sub: string, groups: string[]): Promise<void>;
}
