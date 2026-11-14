import type { Certification, Education, Experience, ProfileDraft, ProfileLink, ProfilePreferences } from '@nextkin/shared/models/profile';
import type { ConfirmFacts, FactProvenance } from '@nextkin/shared/models/profile';
import { sql } from 'kysely';
import type { Database, Identity, Tx } from '../db/database';
import { errors } from '../http/errors';
import { loadProfile, stepId, type LoadedProfile } from './profileRead';

/**
 * Profile writes (ImBackendImplementationPlan P5-04, old plan M1-07). Every write runs under RLS
 * (withUser), recomputes completeness from the stored data in the same transaction, and answers
 * with the whole profile. Completeness moves only when the data does: there is no call that bumps
 * it, and completing a next step changes nothing until the data it asks for exists.
 *
 * Everything typed here is a `user` fact; rows from a confirmed upload are `parsed_confirmed`
 * (§7.4), which the claim ledger (Q-03) cites by id.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Provenance = Exclude<FactProvenance, 'assumed'>;
type Section = 'experience' | 'education' | 'certifications' | 'profile_links';

const notFound = (what: string) => errors.notFound(what);
const normalise = (value: string) => value.trim().toLowerCase();
const nullable = (value: string | undefined) => (value && value.trim() ? value.trim() : null);

/** Runs a write and answers with the whole profile, persisting the derived completeness. */
export async function write(db: Database, identity: Identity, change: (tx: Tx) => Promise<void>): Promise<LoadedProfile> {
  return db.withUser(identity, async (tx) => {
    await change(tx);
    const loaded = await loadProfile(tx, identity.userId);
    if (loaded.completenessBps !== loaded.storedCompletenessBps) {
      const { row_version } = await tx
        .updateTable('profiles')
        .set({ completeness_bps: loaded.completenessBps })
        .where('user_id', '=', identity.userId)
        .returning('row_version')
        .executeTakeFirstOrThrow();
      return { ...loaded, rowVersion: row_version, storedCompletenessBps: loaded.completenessBps };
    }
    return loaded;
  });
}

export const getProfile = (db: Database, identity: Identity) => db.withUser(identity, (tx) => loadProfile(tx, identity.userId));

/** Conditional on the version the client loaded (If-Match), checked inside the update. */
async function conditional(tx: Tx, userId: string, expectedVersion: number, set: Record<string, unknown>) {
  const updated = await tx
    .updateTable('profiles')
    .set(set)
    .where('user_id', '=', userId)
    .where('row_version', '=', expectedVersion)
    .returning('user_id')
    .executeTakeFirst();
  if (!updated) throw errors.preconditionFailed();
}

export interface IdentityPatch {
  headline?: string | null;
  location?: string | null;
  yearsExperience?: number | null;
  phone?: string | null;
  bio?: string | null;
  tagline?: string | null;
}

export function updateIdentity(db: Database, identity: Identity, expectedVersion: number, patch: IdentityPatch) {
  const set: Record<string, unknown> = {};
  const text = (value: string | null | undefined) => (value === null || value === undefined ? null : value.trim() || null);
  if ('headline' in patch) set.headline = text(patch.headline);
  if ('location' in patch) set.location = text(patch.location);
  if ('yearsExperience' in patch) set.years_experience = patch.yearsExperience ?? null;
  if ('phone' in patch) set.phone = text(patch.phone);
  if ('bio' in patch) set.bio = text(patch.bio);
  if ('tagline' in patch) set.tagline = text(patch.tagline);
  return write(db, identity, (tx) => conditional(tx, identity.userId, expectedVersion, set));
}

export function updatePreferences(db: Database, identity: Identity, expectedVersion: number, patch: Partial<ProfilePreferences>) {
  return write(db, identity, (tx) =>
    // jsonb `||` merges at the top level: the patch's keys replace, every other key (including the
    // notification preferences stored beside them) stays.
    conditional(tx, identity.userId, expectedVersion, { preferences: sql`preferences || ${JSON.stringify(patch)}::jsonb` }),
  );
}

// ---------------------------------------------------------------------------------------------
// Entries

async function nextOrder(tx: Tx, table: 'experience' | 'education' | 'profile_links', userId: string): Promise<number> {
  const row = await tx.selectFrom(table).select(sql<number>`coalesce(max(sort_order) + 1, 0)`.as('next')).where('user_id', '=', userId).executeTakeFirst();
  return Number(row?.next ?? 0);
}

async function assertOwned(tx: Tx, table: Section, userId: string, id: string, what: string) {
  if (!UUID.test(id)) throw notFound(what);
  const row = await tx.selectFrom(table).select('id').where('id', '=', id).where('user_id', '=', userId).executeTakeFirst();
  if (!row) throw notFound(what);
}

async function setRoleSkills(tx: Tx, userId: string, experienceId: string, skills: string[], provenance: Provenance) {
  await tx.deleteFrom('experience_skills').where('experience_id', '=', experienceId).execute();
  const unique = [...new Map(skills.map((s) => [normalise(s), s.trim()])).values()].filter(Boolean);
  if (unique.length) {
    await tx
      .insertInto('experience_skills')
      .values(unique.map((raw_name) => ({ experience_id: experienceId, user_id: userId, raw_name, provenance })))
      .execute();
  }
}

const experienceRow = (e: Omit<Experience, 'id'>) => ({
  company: e.company.trim(),
  title: e.title.trim(),
  start_date: e.startDate,
  start_precision: 'day' as const,
  end_date: e.current ? null : (e.endDate ?? null),
  end_precision: e.current || !e.endDate ? null : ('day' as const),
  is_current: e.current,
  description: nullable(e.summary),
  // Sent only when the client has them, so a form that does not edit them never wipes them.
  ...(e.location !== undefined ? { location: nullable(e.location) } : {}),
  ...(e.highlights !== undefined ? { responsibilities: e.highlights.map((line) => line.trim()).filter(Boolean) } : {}),
});

async function insertExperience(tx: Tx, userId: string, e: Omit<Experience, 'id'>, provenance: Provenance) {
  const { id } = await tx
    .insertInto('experience')
    .values({ ...experienceRow(e), user_id: userId, provenance, sort_order: await nextOrder(tx, 'experience', userId) })
    .returning('id')
    .executeTakeFirstOrThrow();
  await setRoleSkills(tx, userId, id, e.skills, provenance);
}

const educationRow = (e: Omit<Education, 'id'>) => ({
  institution: e.institution.trim(),
  degree: e.degree.trim(),
  field: nullable(e.field),
  start_date: e.startDate || null,
  start_precision: e.startDate ? ('day' as const) : null,
  end_date: e.current ? null : (e.endDate ?? null),
  // A year-only end (web onboarding's "Year finished") keeps its precision, so nothing downstream
  // prints a month the user never gave (the facts pipeline reads it as a partial date).
  end_precision: e.current || !e.endDate ? null : (e.endPrecision ?? ('day' as const)),
  is_current: e.current,
});

async function insertEducation(tx: Tx, userId: string, e: Omit<Education, 'id'>, provenance: Provenance) {
  await tx
    .insertInto('education')
    .values({ ...educationRow(e), user_id: userId, provenance, sort_order: await nextOrder(tx, 'education', userId) })
    .execute();
}

const certificationRow = (c: Omit<Certification, 'id'>) => ({
  name: c.name.trim(),
  issuer: c.issuer.trim(),
  issued_on: c.issuedOn ?? null,
  expires_on: c.expiresOn ?? null,
  credential_url: c.credentialUrl ?? null,
});

const linkRow = (l: Omit<ProfileLink, 'id'>) => ({ label: l.label.trim(), url: l.url, kind: l.kind ?? null });

/** The four entry sections share one shape: create (append), replace by id, remove by id. */
export const entries = {
  createExperience: (db: Database, identity: Identity, e: Omit<Experience, 'id'>) =>
    write(db, identity, (tx) => insertExperience(tx, identity.userId, e, 'user')),
  replaceExperience: (db: Database, identity: Identity, id: string, e: Omit<Experience, 'id'>) =>
    write(db, identity, async (tx) => {
      await assertOwned(tx, 'experience', identity.userId, id, 'Experience');
      await tx.updateTable('experience').set({ ...experienceRow(e), provenance: 'user' }).where('id', '=', id).execute();
      await setRoleSkills(tx, identity.userId, id, e.skills, 'user');
    }),
  createEducation: (db: Database, identity: Identity, e: Omit<Education, 'id'>) =>
    write(db, identity, (tx) => insertEducation(tx, identity.userId, e, 'user')),
  replaceEducation: (db: Database, identity: Identity, id: string, e: Omit<Education, 'id'>) =>
    write(db, identity, async (tx) => {
      await assertOwned(tx, 'education', identity.userId, id, 'Education');
      await tx.updateTable('education').set({ ...educationRow(e), provenance: 'user' }).where('id', '=', id).execute();
    }),
  createCertification: (db: Database, identity: Identity, c: Omit<Certification, 'id'>) =>
    write(db, identity, async (tx) => {
      await tx.insertInto('certifications').values({ ...certificationRow(c), user_id: identity.userId }).execute();
    }),
  replaceCertification: (db: Database, identity: Identity, id: string, c: Omit<Certification, 'id'>) =>
    write(db, identity, async (tx) => {
      await assertOwned(tx, 'certifications', identity.userId, id, 'Certification');
      await tx.updateTable('certifications').set({ ...certificationRow(c), provenance: 'user' }).where('id', '=', id).execute();
    }),
  createLink: (db: Database, identity: Identity, l: Omit<ProfileLink, 'id'>) =>
    write(db, identity, async (tx) => {
      await tx.insertInto('profile_links').values({ ...linkRow(l), user_id: identity.userId, sort_order: await nextOrder(tx, 'profile_links', identity.userId) }).execute();
    }),
  replaceLink: (db: Database, identity: Identity, id: string, l: Omit<ProfileLink, 'id'>) =>
    write(db, identity, async (tx) => {
      await assertOwned(tx, 'profile_links', identity.userId, id, 'ProfileLink');
      await tx.updateTable('profile_links').set(linkRow(l)).where('id', '=', id).execute();
    }),
  remove: (db: Database, identity: Identity, section: Section, id: string, what: string) =>
    write(db, identity, async (tx) => {
      await assertOwned(tx, section, identity.userId, id, what);
      await tx.deleteFrom(section).where('id', '=', id).where('user_id', '=', identity.userId).execute();
    }),
};

/** The whole skill list, in the given order; a repeat (ignoring case) keeps its first spelling. */
export function replaceSkills(db: Database, identity: Identity, skills: string[]) {
  return write(db, identity, async (tx) => {
    await tx.deleteFrom('profile_skills').where('user_id', '=', identity.userId).execute();
    const unique = [...new Map(skills.map((s) => [normalise(s), s.trim()])).values()].filter(Boolean);
    if (unique.length) {
      await tx
        .insertInto('profile_skills')
        .values(unique.map((raw_name, sort_order) => ({ user_id: identity.userId, raw_name, sort_order })))
        .execute();
    }
  });
}

/**
 * Commits the accepted rows of a parsed upload (§7.4) as `parsed_confirmed` facts, or as `user` when
 * the person answered for each of them (a finished Zero Resume review), with the mock's dedupe rules: a role matches on company AND title, a degree on institution, a skill on its
 * lower-cased text. Kept rows are appended with server ids.
 */
export interface DraftChoices {
  headline?: 'keep' | 'replace';
  skills?: 'keep' | 'merge' | 'replace';
  experiences?: 'keep' | 'merge' | 'replace';
  education?: 'keep' | 'merge' | 'replace';
  certifications?: 'keep' | 'merge' | 'replace';
}

/**
 * Per section (P7-07): `keep` leaves the profile's as it is, `merge` (the default, and what the
 * apps' `applyProfileDraft` does) adds only what is new, `replace` swaps the section for the
 * draft's. The headline is filled when empty, or replaced on request.
 */
export function applyDraft(db: Database, identity: Identity, draft: ProfileDraft, choices: DraftChoices = {}, provenance: Provenance = 'parsed_confirmed') {
  return write(db, identity, async (tx) => {
    const userId = identity.userId;
    const mode = (section: keyof DraftChoices) => choices[section] ?? 'merge';
    for (const [section, table] of [['skills', 'profile_skills'], ['experiences', 'experience'], ['education', 'education'], ['certifications', 'certifications']] as const) {
      if (mode(section) === 'replace' && (draft[section]?.length ?? 0) > 0) await tx.deleteFrom(table).where('user_id', '=', userId).execute();
    }
    const { profile } = await loadProfile(tx, userId);
    if (draft.headline && (mode('headline') === 'replace' || (mode('headline') !== 'keep' && !profile.headline))) {
      await tx.updateTable('profiles').set({ headline: draft.headline.trim() }).where('user_id', '=', userId).execute();
    }

    if (mode('skills') !== 'keep') {
      const known = new Set(profile.skills.map(normalise));
      let order = profile.skills.length;
      for (const skill of draft.skills ?? []) {
        const key = normalise(skill);
        if (!key || known.has(key)) continue;
        known.add(key);
        await tx.insertInto('profile_skills').values({ user_id: userId, raw_name: skill.trim(), sort_order: order++, provenance }).execute();
      }
    }
    if (mode('experiences') !== 'keep') {
      const roles = new Set(profile.experiences.map((e) => `${normalise(e.company)}\u0000${normalise(e.title)}`));
      for (const e of draft.experiences ?? []) {
        const key = `${normalise(e.company)}\u0000${normalise(e.title)}`;
        if (roles.has(key)) continue;
        roles.add(key);
        await insertExperience(tx, userId, e, provenance);
      }
    }
    if (mode('education') !== 'keep') {
      const schools = new Set(profile.education.map((e) => normalise(e.institution)));
      for (const e of draft.education ?? []) {
        if (schools.has(normalise(e.institution))) continue;
        schools.add(normalise(e.institution));
        await insertEducation(tx, userId, e, provenance);
      }
    }
    if (mode('certifications') !== 'keep') {
      for (const c of draft.certifications ?? []) {
        await tx.insertInto('certifications').values({ ...certificationRow(c), user_id: userId, provenance }).execute();
      }
    }
  });
}

/**
 * Makes facts the person's own word (toreview §146.3): one row, or every row of a kind. A role takes
 * its skill tags with it. Skills have no row of their own to the client, so they go as a list.
 */
export function confirmFacts(db: Database, identity: Identity, { kind, id }: ConfirmFacts) {
  return write(db, identity, async (tx) => {
    const userId = identity.userId;
    if (kind === 'skills') {
      await tx.updateTable('profile_skills').set({ provenance: 'user' }).where('user_id', '=', userId).execute();
      return;
    }
    if (id) await assertOwned(tx, kind, userId, id, 'Fact');
    await tx
      .updateTable(kind)
      .set({ provenance: 'user' })
      .where('user_id', '=', userId)
      .$if(id !== undefined, (q) => q.where('id', '=', id!))
      .execute();
    if (kind === 'experience') {
      await tx
        .updateTable('experience_skills')
        .set({ provenance: 'user' })
        .where('user_id', '=', userId)
        .$if(id !== undefined, (q) => q.where('experience_id', '=', id!))
        .execute();
    }
  });
}

/**
 * Next steps are derived from what is missing, so "completing" one changes nothing by itself: the
 * step goes when the data it asks for exists. Answers with the profile; an unknown step is 404.
 */
export async function completeNextStep(db: Database, identity: Identity, id: string) {
  const loaded = await getProfile(db, identity);
  if (!loaded.profile.nextSteps.some((step) => step.id === id)) throw notFound('NextStep');
  return loaded;
}

export { stepId };
