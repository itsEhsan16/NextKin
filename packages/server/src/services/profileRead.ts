import { profileCompleteness, type CompletenessKey } from '@nextkin/engines/completeness';
import { skillWarnings } from './skillChecks';
import { DEFAULT_NOTIFICATION_PREFS, DEFAULT_NOTIFICATION_SETTINGS } from '@nextkin/shared/models/notification';
import type { NotificationPrefs, NotificationSettings } from '@nextkin/shared/models/notification';
import type { NextStep, Profile, ProfilePreferences, ProfileStats } from '@nextkin/shared/models/profile';
import type { FactProvenance } from '@nextkin/shared/models/profile';
import { sql, type RawBuilder } from 'kysely';
import type { Tx } from '../db/database';

/**
 * Reads the whole profile (ImBackendImplementationPlan P5-04) and derives what the client shows:
 * completeness and next steps from the data (spec §7.3, the engines' weights), and the stats card
 * from C-11's written definitions — absent rather than zero when there is nothing to compute.
 */

/** A `date` column as YYYY-MM-DD text. node-pg would make it a local-midnight Date, which shifts a
 * day in any time zone east of UTC. */
export const dateText = (column: string): RawBuilder<string | null> => sql<string | null>`to_char(${sql.ref(column)}, 'YYYY-MM-DD')`;

/** What a new account's job preferences read as until the user sets them. */
export const DEFAULT_JOB_PREFERENCES: ProfilePreferences = {
  availability: 'open_to_offers',
  locations: [],
  remote: 'any',
  language: 'en',
  desiredRoles: [],
};

/** The labels the completeness card lists, one per missing item (§7.3 "concrete missing items"). */
const STEP_LABEL: Record<CompletenessKey, string> = {
  experience: 'Add your work experience',
  role_skills: 'Tag the skills you used in each role',
  education: 'Add your education',
  skills: 'Add skills',
  headline: 'Add a headline',
  location: 'Add your location',
  phone: 'Add a phone number',
  links: 'Add a link',
  certifications: 'Add a certification',
};

export const stepId = (key: CompletenessKey) => `step_${key}`;

/** The stored preferences hold job preferences at the top level and notification ones beside them. */
export interface StoredPreferences extends Partial<ProfilePreferences> {
  notifications?: { prefs?: NotificationPrefs; settings?: NotificationSettings };
}

export function jobPreferences(stored: unknown): ProfilePreferences {
  const job: Partial<ProfilePreferences> & { notifications?: unknown; gapAnswers?: unknown; resumeSync?: unknown } = { ...((stored ?? {}) as StoredPreferences) };
  delete job.notifications;
  delete job.gapAnswers;
  delete job.resumeSync;
  return { ...DEFAULT_JOB_PREFERENCES, ...job };
}

export function notificationPrefs(stored: unknown): NotificationPrefs {
  return (stored as StoredPreferences | null)?.notifications?.prefs ?? DEFAULT_NOTIFICATION_PREFS;
}

export function notificationSettings(stored: unknown): NotificationSettings {
  return (stored as StoredPreferences | null)?.notifications?.settings ?? DEFAULT_NOTIFICATION_SETTINGS;
}

const opt = <T>(value: T | null | undefined): T | undefined => (value === null ? undefined : value);

export interface LoadedProfile {
  profile: Profile;
  rowVersion: number;
  completenessBps: number;
  storedCompletenessBps: number;
}

export async function loadProfile(tx: Tx, userId: string): Promise<LoadedProfile> {
  const row = await tx.selectFrom('profiles').selectAll().where('user_id', '=', userId).executeTakeFirst();
  if (!row) throw new Error('profile row missing');

  const [roles, roleSkills, education, certifications, links, skills] = await Promise.all([
    tx
      .selectFrom('experience')
      .select(['id', 'provenance', 'company', 'title', 'is_current', 'description', 'location', 'responsibilities', dateText('start_date').as('start'), dateText('end_date').as('end')])
      .where('user_id', '=', userId)
      .orderBy('sort_order')
      .orderBy('created_at')
      .execute(),
    tx.selectFrom('experience_skills').select(['experience_id', 'raw_name']).where('user_id', '=', userId).orderBy('created_at').execute(),
    tx
      .selectFrom('education')
      .select(['id', 'provenance', 'institution', 'degree', 'field', 'is_current', 'end_precision', dateText('start_date').as('start'), dateText('end_date').as('end')])
      .where('user_id', '=', userId)
      .orderBy('sort_order')
      .orderBy('created_at')
      .execute(),
    tx
      .selectFrom('certifications')
      .select(['id', 'provenance', 'name', 'issuer', 'credential_url', dateText('issued_on').as('issued'), dateText('expires_on').as('expires')])
      .where('user_id', '=', userId)
      .orderBy('created_at')
      .execute(),
    tx.selectFrom('profile_links').select(['id', 'label', 'url', 'kind']).where('user_id', '=', userId).orderBy('sort_order').orderBy('created_at').execute(),
    tx.selectFrom('profile_skills').select(['raw_name', 'provenance']).where('user_id', '=', userId).orderBy('sort_order').execute(),
  ]);

  const tagsByRole = new Map<string, string[]>();
  for (const tag of roleSkills) tagsByRole.set(tag.experience_id, [...(tagsByRole.get(tag.experience_id) ?? []), tag.raw_name]);

  const completeness = profileCompleteness({
    headline: row.headline,
    location: row.location,
    phone: row.phone,
    links: links.length,
    skills: skills.length,
    education: education.length,
    certifications: certifications.length,
    roles: roles.map((role) => ({ dated: Boolean(role.start) && (role.is_current || Boolean(role.end)), skillTags: tagsByRole.get(role.id)?.length ?? 0 })),
  });
  const nextSteps: NextStep[] = completeness.missing.map((item) => ({ id: stepId(item.key), label: STEP_LABEL[item.key], icon: 'plus' }));

  const profile: Profile = {
    userId,
    headline: opt(row.headline),
    location: opt(row.location),
    yearsExperience: opt(row.years_experience),
    phone: opt(row.phone),
    bio: opt(row.bio),
    tagline: opt(row.tagline),
    skills: skills.map((s) => s.raw_name),
    experiences: roles.map((role) => ({
      provenance: role.provenance as FactProvenance,
      id: role.id,
      company: role.company,
      title: role.title,
      startDate: role.start!,
      endDate: opt(role.end),
      current: role.is_current,
      skills: tagsByRole.get(role.id) ?? [],
      summary: opt(role.description),
      ...(role.location ? { location: role.location } : {}),
      ...(role.responsibilities?.length ? { highlights: role.responsibilities } : {}),
    })),
    education: education.map((e) => ({
      provenance: e.provenance as FactProvenance,
      id: e.id,
      institution: e.institution,
      degree: e.degree,
      field: opt(e.field),
      // The client model requires a start date; an education row parsed without one reads as its end.
      startDate: e.start ?? e.end ?? '',
      endDate: opt(e.end),
      ...(e.end_precision === 'year' ? { endPrecision: 'year' as const } : {}),
      current: e.is_current,
    })),
    certifications: certifications.map((c) => ({
      provenance: c.provenance as FactProvenance,
      id: c.id,
      name: c.name,
      issuer: c.issuer,
      issuedOn: opt(c.issued),
      expiresOn: opt(c.expires),
      credentialUrl: opt(c.credential_url),
    })),
    links: links.map((l) => ({ id: l.id, label: l.label, url: l.url, kind: opt(l.kind) as Profile['links'][number]['kind'] })),
    stats: await profileStats(tx, userId),
    completeness: completeness.bps / 10_000,
    nextSteps,
    preferences: jobPreferences(row.preferences),
  };
  const toConfirm = skills.filter((s) => s.provenance !== 'user').map((s) => s.raw_name);
  if (toConfirm.length > 0) profile.skillsToConfirm = toConfirm;
  const warnings = skillWarnings(profile.experiences);
  if (warnings.length > 0) profile.skillWarnings = warnings;
  return { profile, rowVersion: row.row_version, completenessBps: completeness.bps, storedCompletenessBps: row.completeness_bps };
}

/**
 * C-11 definitions for the stats card (doc/claims-register.md):
 * - applications, interviews: the Release 2 application tracker; absent until it exists.
 * - avgAtsScore: the mean total, rounded to a whole point, of the latest report on each live
 *   resume's current version that was scored against a JD under the current rubric version.
 *   Absent when there is none.
 */
async function profileStats(tx: Tx, userId: string): Promise<ProfileStats> {
  // The latest report per version (a re-score replaces, it does not average in), then the mean.
  const avg = await tx
    .selectFrom(
      tx
        .selectFrom('resumes as r')
        .innerJoin('ats_reports as a', (join) => join.onRef('a.resume_version_id', '=', 'r.current_version_id').onRef('a.user_id', '=', 'r.user_id'))
        .innerJoin('rubric_versions as rv', 'rv.id', 'a.rubric_version_id')
        .distinctOn('a.resume_version_id')
        .select(['a.resume_version_id', 'a.total_bps'])
        .where('r.user_id', '=', userId)
        .where('r.trashed_at', 'is', null)
        .where('a.has_jd', '=', true)
        .where('rv.is_current', '=', true)
        .where('a.total_bps', 'is not', null)
        .orderBy('a.resume_version_id')
        .orderBy('a.created_at', 'desc')
        .as('latest'),
    )
    .select(sql<string | null>`avg(latest.total_bps)`.as('avg'))
    .executeTakeFirst();
  const mean = avg?.avg == null ? undefined : Math.round(Number(avg.avg) / 100);
  return mean === undefined ? {} : { avgAtsScore: mean };
}
