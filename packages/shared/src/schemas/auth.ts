import { z } from 'zod';

/**
 * Auth request and response shapes (spec §11 `/api/v1/auth/*`, ImBackendImplementationPlan P4-08).
 * Shared so the mobile auth client (P4-10) and the server validate the same thing.
 */

export const clientKindSchema = z.enum(['web', 'mobile']);

const email = z.email().max(254);
const password = z.string().min(1).max(128);

export const signUpSchema = z.object({ email, password, name: z.string().max(200).optional() }).strict();
export const confirmSchema = z.object({ email, code: z.string().regex(/^\d{6}$/) }).strict();
export const emailOnlySchema = z.object({ email }).strict();
export const loginSchema = z.object({ email, password, client: clientKindSchema.default('web') }).strict();
// Staff sign-in (toreview §171.13): the authenticator's six digits or a backup code (`4f2a-9c10`).
const staffCode = z.string().trim().regex(/^(\d{6}|[0-9a-fA-F]{4}-[0-9a-fA-F]{4})$/);
const challenge = z.string().min(16).max(128);
export const adminLoginSchema = z.object({ email, password, totp: staffCode.optional() }).strict();
export const adminEnrollSchema = z.object({ challenge, code: z.string().trim().regex(/^\d{6}$/) }).strict();
export const adminSetPasswordSchema = z.object({ challenge, password }).strict();
export const adminReauthSchema = z.object({ code: staffCode }).strict();
export const resetPasswordSchema = z.object({ email, code: z.string().regex(/^\d{6}$/), password }).strict();
export const changePasswordSchema = z.object({ current: password, next: password }).strict();
export const refreshSchema = z.object({ refreshToken: z.string().min(16).max(512) }).strict();
export const exchangeSchema = z.object({ code: z.string().min(16).max(128) }).strict();

export const sessionUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  emailVerified: z.boolean(),
  role: z.enum(['user', 'admin', 'curator', 'support']),
});

export const tokenSetSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int(),
});

export const sessionSchema = z.object({ user: sessionUserSchema });
/** What a staff sign-in step answers: the next step, or the session. */
export const adminSignInStepSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('mfa_required') }),
  z.object({ status: z.literal('enroll_totp'), challenge: z.string(), secret: z.string(), otpauthUrl: z.string() }),
  z.object({ status: z.literal('change_password'), challenge: z.string(), backupCodes: z.array(z.string()).optional() }),
  z.object({ status: z.literal('signed_in'), user: sessionUserSchema, backupCodes: z.array(z.string()).optional() }),
]);
export type AdminSignInStepWire = z.infer<typeof adminSignInStepSchema>;
export const mobileSessionSchema = z.object({ user: sessionUserSchema, tokens: tokenSetSchema });
export const acceptedSchema = z.object({ status: z.literal('accepted') });

export type SessionUser = z.infer<typeof sessionUserSchema>;
export type TokenSetWire = z.infer<typeof tokenSetSchema>;
