import { z } from 'zod';
import type {
  Certification,
  Education,
  Experience,
  NextStep,
  Profile,
  ProfileDraft,
  ProfilePreferences,
} from '../models/profile';
import type { ConfirmFacts } from '../models/profile';
import { profileLinkSchema } from './settings';

/**
 * The profile over the wire (spec §11 `/api/v1/profile`; ImBackendImplementationPlan P5-04).
 * Every write answers with the whole profile, as `ProfileRepo` promises, so the completeness
 * meter and the next steps can never be stale. Each schema is checked against its model type.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.');
const text = (max: number) => z.string().trim().min(1).max(max);
const tag = z.string().trim().min(1).max(120);

const provenance = z.enum(['user', 'parsed_confirmed', 'assumed']);

/** What a tap on Confirm sends (toreview §146.3): one row, or a whole kind. */
export const confirmFactsSchema = z.object({
  kind: z.enum(['experience', 'education', 'certifications', 'skills']),
  id: z.string().optional(),
}) satisfies z.ZodType<ConfirmFacts>;

export const experienceSchema = z.object({
  id: z.string(),
  provenance: provenance.optional(),
  company: text(200),
  title: text(200),
  startDate: isoDate,
  endDate: isoDate.optional(),
  current: z.boolean(),
  skills: z.array(tag).max(50),
  summary: z.string().max(4000).optional(),
}) satisfies z.ZodType<Experience>;

export const educationSchema = z.object({
  id: z.string(),
  provenance: provenance.optional(),
  institution: text(200),
  degree: text(200),
  field: z.string().max(200).optional(),
  // Blank when unknown: the server reads a row with no start back this way.
  startDate: isoDate.or(z.literal('')),
  endDate: isoDate.optional(),
  endPrecision: z.literal('year').optional(),
  current: z.boolean(),
}) satisfies z.ZodType<Education>;

export const certificationSchema = z.object({
  id: z.string(),
  provenance: provenance.optional(),
  name: text(200),
  issuer: text(200),
  issuedOn: isoDate.optional(),
  expiresOn: isoDate.optional(),
  credentialUrl: z
    .url({ protocol: /^https?$/ })
    .max(2000)
    .optional(),
}) satisfies z.ZodType<Certification>;

const salarySchema = z.object({
  min: z.number().int().nonnegative().optional(),
  max: z.number().int().nonnegative().optional(),
  currency: z.enum(['USD', 'EUR', 'AUD', 'INR']),
  period: z.enum(['year', 'month', 'hour']),
  estimated: z.boolean().optional(),
});

export const profilePreferencesSchema = z.object({
  availability: z.enum(['immediately', '2_weeks', '1_month', 'open_to_offers', 'not_looking']),
  minSalary: salarySchema.optional(),
  locations: z.array(text(200)).max(20),
  remote: z.enum(['remote', 'hybrid', 'onsite', 'any']),
  language: z.enum(['en', 'de']),
  desiredRoles: z.array(text(200)).max(5),
  employmentTypes: z
    .array(z.enum(['full_time', 'part_time', 'contract', 'internship', 'freelance']))
    .optional(),
  industries: z.array(text(120)).max(20).optional(),
  careerGoal: z.enum(['first_job', 'better_role', 'new_field', 'exploring']).optional(),
  experienceBand: z.enum(['new_grad', '1_2', '3_5', '6_10', '10_plus']).optional(),
}) satisfies z.ZodType<ProfilePreferences>;

export const nextStepSchema = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.string(),
}) satisfies z.ZodType<NextStep>;

export const profileSchema = z.object({
  userId: z.string(),
  headline: z.string().optional(),
  location: z.string().optional(),
  yearsExperience: z.number().int().optional(),
  phone: z.string().optional(),
  bio: z.string().optional(),
  tagline: z.string().optional(),
  linkedinConnected: z.boolean().optional(),
  skills: z.array(z.string()),
  skillsToConfirm: z.array(z.string()).optional(),
  experiences: z.array(experienceSchema),
  education: z.array(educationSchema),
  certifications: z.array(certificationSchema),
  links: z.array(profileLinkSchema),
  stats: z.object({
    applications: z.number().int().optional(),
    interviews: z.number().int().optional(),
    avgAtsScore: z.number().optional(),
  }),
  /** 0–1, derived on the server from §7.3's weights. */
  completeness: z.number().min(0).max(1),
  /** Skills tagged outside their role's era (P9-05): warnings, never a block. */
  skillWarnings: z
    .array(
      z.object({
        experienceId: z.string(),
        skill: z.string(),
        verdict: z.enum(['invalid', 'suspect', 'unverified']),
        message: z.string(),
      }),
    )
    .optional(),
  nextSteps: z.array(nextStepSchema),
  preferences: profilePreferencesSchema,
}) satisfies z.ZodType<Profile>;

/**
 * The identity fields. Wider than the mobile `ProfilePatch` (which writes three of them) because the
 * web Account board edits phone, bio and tagline as well. `null` clears a field.
 */
export const profilePatchSchema = z
  .object({
    headline: z.string().trim().max(200).nullable(),
    location: z.string().trim().max(200).nullable(),
    yearsExperience: z.number().int().min(0).max(70).nullable(),
    phone: z.string().trim().max(40).nullable(),
    bio: z.string().trim().max(4000).nullable(),
    tagline: z.string().trim().max(200).nullable(),
  })
  .partial()
  .strict();

export const preferencesPatchSchema = profilePreferencesSchema.partial().strict();

// Inputs carry no id: the server issues it (an upsert to an unknown id appends, as the mock does).
export const experienceInputSchema = experienceSchema.omit({ id: true }).strict();
export const educationInputSchema = educationSchema.omit({ id: true }).strict();
export const certificationInputSchema = certificationSchema.omit({ id: true }).strict();
export const skillsInputSchema = z.object({ skills: z.array(tag).max(200) }).strict();

export const profileDraftSchema = z
  .object({
    headline: z.string().trim().max(200).optional(),
    skills: z.array(tag).max(200).optional(),
    experiences: z.array(experienceSchema).max(50).optional(),
    education: z.array(educationSchema).max(20).optional(),
    certifications: z.array(certificationSchema).max(50).optional(),
  })
  .strict() satisfies z.ZodType<ProfileDraft>;
