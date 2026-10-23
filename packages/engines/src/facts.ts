/**
 * Profile facts and the canonical document the claim ledger reads (ImBackendImplementationPlan
 * P9-02, P9-04; G13). Every fact has a stable id; every claim on a generated document cites the
 * fact ids it derives from. A role's description and responsibilities are facts of their own
 * (`<roleId>#d`, `<roleId>#r<i>`), so a bullet can cite exactly what it rests on.
 *
 * These types carry no contact detail and no name: the generator's input is built from them (G5).
 */

import type { PartialDate } from './dates';

export interface FactRole {
  id: string;
  company: string;
  title: string;
  start: PartialDate;
  /** null: a current role. */
  end: PartialDate | null;
  location?: string;
  description?: string;
  responsibilities: readonly string[];
  /** The role's skill tags. */
  skills: readonly string[];
}

export interface FactEducation {
  id: string;
  institution: string;
  degree: string;
  field?: string;
  start?: PartialDate | null;
  end?: PartialDate | null;
}

export interface FactCertification {
  id: string;
  name: string;
  issuer: string;
}

export interface FactProject {
  id: string;
  name: string;
  description?: string;
  /** A tailored run's project lines, each citable as `${id}#p${i}` (toreview §113). */
  lines?: readonly string[];
  /** Its stack, and keywords the user said they used there. */
  skills?: readonly string[];
}

export interface ProfileFacts {
  headline?: string;
  summary?: string;
  /** Skills listed on the profile, outside any role. */
  skills: readonly string[];
  roles: readonly FactRole[];
  education: readonly FactEducation[];
  certifications: readonly FactCertification[];
  projects: readonly FactProject[];
}

/**
 * Where a claim came from (G13): `generated` claims must cite facts; `user` claims (typed in the
 * editor) are warned about, never blocked (§7.11); `assumed` claims (Zero Resume, §7.9) block
 * export until the user resolves them.
 */
export type ClaimOrigin = 'generated' | 'user' | 'assumed';

export interface Claim {
  id: string;
  text: string;
  evidence: readonly string[];
  origin: ClaimOrigin;
}

export interface CanonicalRole {
  roleId: string;
  company: string;
  title: string;
  start: PartialDate | null;
  end: PartialDate | null;
  bullets: readonly Claim[];
}

/** The canonical resume (P9-02) in the shape the engines check. */
export interface CanonicalResume {
  headline?: string;
  summary?: Claim;
  skills: readonly (Claim & { name: string })[];
  roles: readonly CanonicalRole[];
  education: readonly { factId: string; institution: string; degree: string }[];
  certifications: readonly { factId: string; name: string }[];
  projects: readonly { factId: string; name: string; bullets: readonly Claim[] }[];
}

/** A fact's text by id: the role itself (company, title), its description, each responsibility. */
export function factIndex(facts: ProfileFacts): Map<string, { roleId?: string; text: string }> {
  const index = new Map<string, { roleId?: string; text: string }>();
  for (const role of facts.roles) {
    index.set(role.id, { roleId: role.id, text: [role.title, role.company, role.description ?? '', ...role.responsibilities].join('\n') });
    if (role.description) index.set(`${role.id}#d`, { roleId: role.id, text: role.description });
    role.responsibilities.forEach((text, i) => index.set(`${role.id}#r${i}`, { roleId: role.id, text }));
  }
  for (const e of facts.education) index.set(e.id, { text: [e.degree, e.field ?? '', e.institution].join('\n') });
  for (const c of facts.certifications) index.set(c.id, { text: `${c.name}\n${c.issuer}` });
  for (const p of facts.projects) {
    index.set(p.id, { text: [p.name, p.description ?? ''].join('\n') });
    (p.lines ?? []).forEach((text, i) => index.set(`${p.id}#p${i}`, { text }));
  }
  if (facts.summary) index.set('profile#summary', { text: facts.summary });
  if (facts.headline) index.set('profile#headline', { text: facts.headline });
  return index;
}
