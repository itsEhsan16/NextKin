import type { EmploymentType, ExperienceLevel } from '../models/job';
import type { JdStructured } from '../models/jdStructured';

/**
 * The flat lists every consumer reads (match, tailor comparison, generation, interview prep, the
 * mobile app), derived from the structured reading (toreview §153) so none of them changes.
 * Required and preferred split by the posting's own importance; soft skills stay apart and are never
 * scored. Tools are no longer a separate list: a tool the posting requires is required.
 */
export type JdLegacyFields = {
  title: string | null;
  company: string | null;
  location: string | null;
  experienceLevel: ExperienceLevel | null;
  employmentType: EmploymentType | null;
  domain: string | null;
  requiredSkills: string[];
  preferredSkills: string[];
  tools: string[];
  responsibilities: string[];
  softSkills: string[];
};

export function legacyFields(s: JdStructured): JdLegacyFields {
  const hard = s.skills.filter((k) => k.category !== 'soft');
  return {
    title: s.identity.title?.value ?? null,
    company: s.identity.company?.value ?? null,
    location: s.locations[0]?.value.label ?? null,
    experienceLevel: s.identity.seniority?.value ?? null,
    employmentType: s.identity.employmentType?.value ?? null,
    domain: s.identity.industry?.value ?? null,
    requiredSkills: hard.filter((k) => k.importance === 'required').map((k) => k.value),
    preferredSkills: hard.filter((k) => k.importance === 'preferred').map((k) => k.value),
    tools: [],
    responsibilities: s.responsibilities.map((r) => r.value),
    softSkills: s.skills.filter((k) => k.category === 'soft').map((k) => k.value),
  };
}

/** Whether a stored reading is the current structure (rows read before §153 have none). */
export const isStructured = (value: unknown): value is JdStructured =>
  typeof value === 'object' &&
  value !== null &&
  (value as { schemaVersion?: unknown }).schemaVersion === 2;
