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
export const adminLoginSchema = z.object({ email, password, totp: z.string().regex(/^\d{6}$/).optional() }).strict();
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
export const mobileSessionSchema = z.object({ user: sessionUserSchema, tokens: tokenSetSchema });
export const acceptedSchema = z.object({ status: z.literal('accepted') });

export type SessionUser = z.infer<typeof sessionUserSchema>;
export type TokenSetWire = z.infer<typeof tokenSetSchema>;
