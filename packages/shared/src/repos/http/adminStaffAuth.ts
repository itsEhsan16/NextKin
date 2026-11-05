import { z } from 'zod';

import type { AdminSettings, AdminSettingsPatch, AdminSignInResult, AuthenticatorSetup } from '../../models/adminTrust';
import { adminSignInStepSchema } from '../../schemas/auth';
import type { AdminTrustRepo } from '../adminTrustRepo';
import { ApiError, type HttpClient } from './client';

/**
 * Staff sign-in and Settings over HTTP (toreview §171.13): `/auth/admin/*` and `/admin/settings*`.
 * Staff accounts are the server's own, with a password and an authenticator; a new or reset account
 * sets up its authenticator and replaces its temporary password on the way in.
 */

const iso = z.string();
const settingsSchema = z.object({
  requireMfa: z.literal(true),
  authenticator: z.object({ addedAt: iso, lastUsedAt: iso }).nullable(),
  backupCodes: z.object({ unused: z.number().int(), total: z.number().int() }),
  sessionTimeoutMinutes: z.number().int(),
  reauthForSensitive: z.boolean(),
  allowedNetworks: z.array(z.object({ cidr: z.string(), label: z.string() })),
  currentIp: z.string().nullable(),
  lastSignIn: z.object({ at: iso, ip: z.string().nullable() }).nullable(),
  retention: z.array(z.object({ label: z.string(), value: z.string() })),
});
const setupSchema = z.object({ challenge: z.string(), secret: z.string(), otpauthUrl: z.string() });

/** The server's answer, minus the user record the portal doesn't need (it reads `/admin/me`). */
const toResult = (raw: unknown): AdminSignInResult => {
  const step = adminSignInStepSchema.parse(raw);
  if (step.status === 'signed_in') return { status: 'signed_in', ...(step.backupCodes ? { backupCodes: step.backupCodes } : {}) };
  return step;
};

/**
 * Every refused credential reads the same on the server ("Sign in to continue."), which is nonsense
 * on the sign-in card: say which step was refused instead.
 */
const refused = (error: unknown, message: string): never => {
  if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') {
    throw new ApiError(error.code, message, error.status, error.details, error.requestId);
  }
  throw error;
};

type StaffAuthMethods = Pick<
  AdminTrustRepo,
  | 'settings'
  | 'updateSettings'
  | 'regenerateBackupCodes'
  | 'beginAuthenticatorReplacement'
  | 'confirmAuthenticatorReplacement'
  | 'reauthenticate'
  | 'signIn'
  | 'confirmEnrollment'
  | 'setNewPassword'
>;

export function createStaffAuthOps(http: HttpClient): StaffAuthMethods {
  const post = (path: string, body: unknown) => http.request(path, { method: 'POST', body, authenticated: false });
  return {
    settings: async (): Promise<AdminSettings> => settingsSchema.parse(await http.request('/admin/settings')),
    updateSettings: async (patch: AdminSettingsPatch) => settingsSchema.parse(await http.request('/admin/settings', { method: 'PATCH', body: patch })),
    regenerateBackupCodes: async () => z.object({ codes: z.array(z.string()) }).parse(await http.request('/admin/settings/backup-codes', { method: 'POST' })).codes,
    beginAuthenticatorReplacement: async (): Promise<AuthenticatorSetup> => setupSchema.parse(await http.request('/admin/settings/authenticator', { method: 'POST' })),
    confirmAuthenticatorReplacement: async ({ challenge, code }) =>
      z.object({ backupCodes: z.array(z.string()) }).parse(await http.request('/admin/settings/authenticator/confirm', { method: 'POST', body: { challenge, code: code.trim() } })).backupCodes,
    reauthenticate: async (code) => {
      await http.request('/auth/admin/reauth', { method: 'POST', body: { code: code.trim() } });
    },

    signIn: async ({ email, password, totp }) => {
      try {
        return toResult(await post('/auth/admin/login', { email, password, ...(totp ? { totp: totp.trim() } : {}) }));
      } catch (error) {
        return refused(error, totp ? 'That code didn’t work. Check your app and try again.' : 'That email and password don’t match a staff account.');
      }
    },
    confirmEnrollment: async ({ challenge, code }) => toResult(await post('/auth/admin/enroll', { challenge, code: code.trim() })),
    setNewPassword: async ({ challenge, password }) => toResult(await post('/auth/admin/password', { challenge, password })),
  };
}
