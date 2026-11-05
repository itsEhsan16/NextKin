import type { Identity } from '../db/database';
import type { Logger } from '../observability/logger';

/** How the request proved who it is. CSRF checks apply to cookie sessions only. */
export type AuthVia = 'cookie' | 'bearer';

export interface Authenticated {
  identity: Identity;
  via: AuthVia;
  /** The server session the request rides on (the cookie id, or the token's `sid`). */
  sessionId?: string;
  /** A Super Admin staff session (§7.17), from the admin pool's `super_admin` group at sign-in. */
  superAdmin?: boolean;
  /** Staff sessions (toreview §171.13): the staff account, and when its authenticator was last proven. */
  staff?: { accountId: string; mfaAt: number };
}

/** Per-request values set by the middleware chain (ImBackendImplementationPlan P3-03). */
export type ApiEnv = {
  Variables: {
    requestId: string;
    log: Logger;
    clientIp: string;
    client: string | null;
    clientVersion: string | null;
    auth: Authenticated | null;
  };
};
