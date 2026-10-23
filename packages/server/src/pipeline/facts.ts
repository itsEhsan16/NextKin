import type { PartialDate } from '@nextkin/engines/dates';
import type { ProfileFacts } from '@nextkin/engines/facts';
import type { ContactPresence } from '@nextkin/shared/scoring/adapters';
import { sql } from 'kysely';

import { redactContact } from '../ai/pii';
import type { Tx } from '../db/database';

/**
 * The profile as facts with ids (ImBackendImplementationPlan P9-03, P9-04; G5, G13). Taken once at
 * job start and kept on the run, so every stage — and a redelivered one — reads the same profile.
 *
 * No name, email, phone or link is in here: the generator never sees contact details (G5); they are
 * merged in when the file is rendered (P10). Free text (descriptions, responsibilities, the bio) is
 * contact-redacted on the way in, so a stray email in a bio cannot reach a model input. What the
 * scorer needs to know about contact is presence only.
 */

export interface FactsSnapshot {
  facts: ProfileFacts;
  contact: ContactPresence;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

function partial(date: string | null, precision: string | null): PartialDate | null {
  const m = date ? ISO.exec(date) : null;
  if (!m) return null;
  return precision === 'year' ? { year: Number(m[1]) } : { year: Number(m[1]), month: Number(m[2]) };
}

const clean = (text: string | null | undefined): string | undefined => (text ? redactContact(text).trim() || undefined : undefined);

export async function loadFacts(tx: Tx, userId: string): Promise<FactsSnapshot> {
  const day = (column: string) => sql<string | null>`to_char(${sql.ref(column)}, 'YYYY-MM-DD')`;
  const [profile, roles, roleSkills, education, certifications, projects, skills] = await Promise.all([
    tx.selectFrom('profiles').select(['headline', 'bio', 'phone', 'location']).where('user_id', '=', userId).executeTakeFirst(),
    tx
      .selectFrom('experience')
      .select(['id', 'company', 'title', 'location', 'description', 'responsibilities', 'is_current', 'start_precision', 'end_precision', day('start_date').as('start'), day('end_date').as('end')])
      .where('user_id', '=', userId)
      .orderBy('start_date', 'desc')
      .execute(),
    tx.selectFrom('experience_skills').select(['experience_id', 'raw_name']).where('user_id', '=', userId).orderBy('created_at').execute(),
    tx
      .selectFrom('education')
      .select(['id', 'institution', 'degree', 'field', 'is_current', 'start_precision', 'end_precision', day('start_date').as('start'), day('end_date').as('end')])
      .where('user_id', '=', userId)
      .orderBy('sort_order')
      .execute(),
    tx.selectFrom('certifications').select(['id', 'name', 'issuer']).where('user_id', '=', userId).execute(),
    tx.selectFrom('projects').select(['id', 'name', 'description']).where('user_id', '=', userId).orderBy('sort_order').execute(),
    tx.selectFrom('profile_skills').select('raw_name').where('user_id', '=', userId).orderBy('sort_order').execute(),
  ]);

  const facts: ProfileFacts = {
    ...(clean(profile?.headline) ? { headline: clean(profile?.headline)! } : {}),
    ...(clean(profile?.bio) ? { summary: clean(profile?.bio)! } : {}),
    skills: skills.map((s) => s.raw_name),
    roles: roles.map((r) => ({
      id: r.id,
      company: r.company,
      title: r.title,
      start: partial(r.start, r.start_precision) ?? { year: 1970 },
      end: r.is_current ? null : partial(r.end, r.end_precision),
      ...(r.location ? { location: r.location } : {}),
      ...(clean(r.description) ? { description: clean(r.description)! } : {}),
      responsibilities: (r.responsibilities ?? []).map((line) => clean(line)).filter((line): line is string => Boolean(line)),
      skills: roleSkills.filter((s) => s.experience_id === r.id).map((s) => s.raw_name),
    })),
    education: education.map((e) => ({
      id: e.id,
      institution: e.institution,
      degree: e.degree,
      ...(e.field ? { field: e.field } : {}),
      start: partial(e.start, e.start_precision),
      end: e.is_current ? null : partial(e.end, e.end_precision),
    })),
    certifications: certifications.map((c) => ({ id: c.id, name: c.name, issuer: c.issuer })),
    projects: projects.map((p) => ({ id: p.id, name: p.name, ...(clean(p.description) ? { description: clean(p.description)! } : {}) })),
  };
  return { facts, contact: { email: true, phone: Boolean(profile?.phone), location: Boolean(profile?.location) } };
}
