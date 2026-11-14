import type { PartialDate } from '@nextkin/engines/dates';
import type { ScoringDocument } from '@nextkin/engines/document';
import type { FactRole, ProfileFacts } from '@nextkin/engines/facts';
import type { JdStated } from '@nextkin/engines/requirements';
import type { ContactPresence } from '@nextkin/shared/scoring/adapters';
import { z } from 'zod';

import type { FactsSnapshot } from '../facts';

/**
 * What every P9 stage reads from the run (ImBackendImplementationPlan P9-03): the client's request,
 * the facts snapshot taken at start, and `asOf`, fixed at start so a resumed run judges dates
 * exactly as the first attempt did (G12).
 */

const partial = z.object({ year: z.number().int(), month: z.number().int().min(1).max(12).optional() });

export const runInputSchema = z
  .object({
    kind: z.enum(['resume', 'cover_letter', 'zero_resume', 'ats_check', 'interview', 'section']),
    /** A `section` run: which section of `sourceResumeId` to regenerate (P10-02). */
    section: z.enum(['summary', 'skills', 'experience', 'projects', 'certifications', 'education']).optional(),
    jdId: z.string().optional(),
    title: z.string().optional(),
    tone: z.enum(['professional', 'confident', 'conversational', 'concise']).optional(),
    sourceResumeId: z.string().optional(),
    /** A section run's "AI rewrite" request, as the user typed it (toreview §113). Data, never a rule. */
    instruction: z.string().max(300).optional(),
    baseResumeId: z.string().optional(),
    origin: z.literal('build').optional(),
    zero: z.object({ yearsExperience: z.number().min(0).max(60), targetRole: z.string().optional() }).passthrough().optional(),
    asOf: partial,
    snapshot: z.custom<FactsSnapshot>((v) => typeof v === 'object' && v !== null && 'facts' in v),
  })
  .passthrough();
export type RunInput = z.infer<typeof runInputSchema>;

export const readRun = (run: Record<string, unknown>): RunInput => runInputSchema.parse(run);

/** The JD as generation and scoring read it (the user's corrections included). */
export interface StageJd {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  requiredSkills: string[];
  preferredSkills: string[];
  tools: string[];
  responsibilities: string[];
  rawText: string;
  completeness: 'full' | 'snippet';
  language: 'en' | 'de' | 'other' | null;
  /** The structured reading's years and conditions (toreview §206.2), when the JD has one. */
  stated?: JdStated;
}

export const isoOf = (d: PartialDate | null | undefined): string | null =>
  d ? (d.month ? `${d.year}-${String(d.month).padStart(2, '0')}` : String(d.year)) : null;

/** "Mar 2022 — Present" for a model input; the canonical document stores the dates. */
export function periodOf(role: Pick<FactRole, 'start' | 'end'>): string {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const one = (d: PartialDate) => (d.month ? `${MONTHS[d.month - 1]} ${d.year}` : String(d.year));
  return `${one(role.start)} — ${role.end ? one(role.end) : 'Present'}`;
}

/** The profile as the rubric's yardstick (G16): each dated role with its tags and facts. */
export function profileDocument(facts: ProfileFacts, contact: ContactPresence): ScoringDocument {
  return {
    ...(facts.headline ? { headline: facts.headline } : {}),
    ...(facts.summary ? { summary: facts.summary } : {}),
    skills: facts.skills,
    roles: facts.roles.map((r) => ({
      id: r.id,
      title: r.title,
      company: r.company,
      start: r.start,
      end: r.end,
      bullets: [r.description ?? '', ...r.responsibilities].filter(Boolean),
      skills: r.skills,
    })),
    education: facts.education.map((e) => ({ institution: e.institution, degree: e.degree })),
    certifications: facts.certifications.map((c) => c.name),
    contact,
  };
}
