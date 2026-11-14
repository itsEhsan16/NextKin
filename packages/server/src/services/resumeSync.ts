import type { LinkKind, ResumeSyncChanges, ResumeSyncDecision, ResumeSyncStatus } from '@nextkin/shared/models/profile';
import { resumeSyncHasChanges } from '@nextkin/shared/models/profile';
import { EMAIL, PHONE, isPhone } from '@nextkin/shared/privacy/contact';
import { canonicalResumeSchema, type CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';
import { sql } from 'kysely';

import type { Database, Identity, Tx } from '../db/database';
import { errors } from '../http/errors';
import { write } from './profile';
import type { LoadedProfile } from './profileRead';

/**
 * The profile, filled from the base resume.
 *
 * The base resume is the fullest statement of the person's history the app holds: its structured
 * body (`resume_versions.content`, the canonical JSON the parse wrote, line for line from the file)
 * carries every role with its bullets, the schools, the skills, the certifications, the projects and
 * the header's phone, place and links. All of it is read into the profile, so a resume built from
 * the profile has what the resume had.
 *
 * Nothing the person typed is ever overwritten: a row already on the profile is matched and only
 * its blanks are filled, a single field only when it is empty, and what is new is appended. Facts
 * a Zero Resume draft assumed are left out (they are guesses, not the person's word).
 *
 * When it runs: the first time, without asking (`state: 'first'`); after that, once per new base
 * version that would add anything, on the person's yes. A no is remembered for that version only.
 * The marker lives in `profiles.preferences.resumeSync`, beside the notification preferences.
 */

type Partial = { date: string; precision: 'month' | 'year' };

export interface ImportRole {
  company: string;
  title: string;
  location?: string;
  start: Partial;
  end: Partial | null;
  highlights: string[];
  skills: string[];
}

export interface ImportEducation {
  institution: string;
  degree: string;
  field?: string;
  start: Partial | null;
  end: Partial | null;
  current: boolean;
}

export interface ImportLink {
  label: string;
  url: string;
  kind: LinkKind;
}

export interface ResumeProfileImport {
  headline?: string;
  bio?: string;
  phone?: string;
  location?: string;
  years?: number;
  links: ImportLink[];
  skills: string[];
  roles: ImportRole[];
  education: ImportEducation[];
  certifications: { name: string; issuer: string }[];
  projects: { name: string; description?: string }[];
}

// ---------------------------------------------------------------------------------------------
// Reading the resume

/** "React.js", "ReactJS" and "react js" are one skill; "C", "C++" and "C#" are three. */
export const skillKey = (name: string) => name.trim().toLowerCase().replace(/[\s._-]+/g, '');
const key = (text: string) => text.trim().toLowerCase().replace(/[^a-z0-9+#]+/g, ' ').trim();

function partial(value: string | null | undefined): Partial | null {
  if (!value) return null;
  const [year, month] = value.split('-');
  return month ? { date: `${year}-${month}-01`, precision: 'month' } : { date: `${year}-01-01`, precision: 'year' };
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The skills a role's own lines name. A short name ("Go", "R", "C") must match its case, so the
 * verb "go" is not the language; a longer one matches whole, ignoring case.
 */
export function skillsNamedIn(text: string, skills: readonly string[]): string[] {
  if (!text) return [];
  return skills.filter((skill) => {
    const name = skill.trim();
    if (!name) return false;
    const pattern = new RegExp(`(?<![A-Za-z0-9])${escape(name)}(?![A-Za-z0-9+#])`, name.length <= 2 ? '' : 'i');
    return pattern.test(text);
  });
}

const LINK_LABEL: Record<LinkKind, string> = { linkedin: 'LinkedIn', github: 'GitHub', portfolio: 'Portfolio', website: 'Website', other: 'Link' };

function linkFrom(text: string, url: string): ImportLink | null {
  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(parsed.protocol)) return null;
  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
  const kind: LinkKind = host.endsWith('linkedin.com')
    ? 'linkedin'
    : host.endsWith('github.com')
      ? 'github'
      : /portfolio/i.test(text) || /behance|dribbble|vercel\.app|netlify\.app|github\.io/.test(host)
        ? 'portfolio'
        : 'website';
  return { label: LINK_LABEL[kind], url: parsed.toString().replace(/\/$/, ''), kind };
}

/** A contact-row item that is a place: words, maybe a comma, no digits, no address of any kind. */
const looksLikePlace = (text: string) =>
  text.length <= 80 && /[a-z]/i.test(text) && !/[@\d/]/.test(text) && !/\.(com|io|in|dev|me|org|net)\b/i.test(text) && !/^(linkedin|github|portfolio|website|email|phone|resume)$/i.test(text.trim());

/** Merged months across roles, overlaps counted once: the honest "years of experience". */
function yearsAcross(roles: readonly ImportRole[], today = new Date()): number | undefined {
  const spans = roles
    .map((role) => {
      const [sy, sm] = role.start.date.split('-').map(Number);
      const endDate = role.end ? role.end.date : today.toISOString().slice(0, 10);
      const [ey, em] = endDate.split('-').map(Number);
      return [sy! * 12 + (sm! - 1), ey! * 12 + (em! - 1) + (role.end?.precision === 'year' ? 11 : 0)] as const;
    })
    .filter(([a, b]) => b >= a)
    .sort((x, y) => x[0] - y[0]);
  if (spans.length === 0) return undefined;
  let months = 0;
  let [from, to] = spans[0]!;
  for (const [a, b] of spans.slice(1)) {
    if (a <= to) to = Math.max(to, b);
    else {
      months += to - from + 1;
      [from, to] = [a, b];
    }
  }
  months += to - from + 1;
  return Math.floor(months / 12);
}

/** Everything the profile can hold, read from a resume's structured body. Pure. */
export function readResumeForProfile(doc: CanonicalResumeJson, today = new Date()): ResumeProfileImport {
  const own = <T extends { origin?: string }>(item: T | undefined) => (item && item.origin !== 'assumed' ? item : undefined);

  // Skills: the file's skill list, then every role's tags, then each project's stack line.
  const skills: string[] = [];
  const seen = new Set<string>();
  const addSkill = (name: string) => {
    const trimmed = name.trim().replace(/\s+/g, ' ');
    const k = skillKey(trimmed);
    if (!k || trimmed.length > 120 || seen.has(k)) return;
    seen.add(k);
    skills.push(trimmed);
  };
  for (const skill of doc.skills) if (skill.origin !== 'assumed') addSkill(skill.name);
  for (const role of doc.roles) if (!role.assumed) role.skills.forEach(addSkill);
  for (const project of doc.projects) (project.tech ?? '').split(/[,|/•·]/).forEach((part) => part.trim().length >= 2 && addSkill(part));

  const roles: ImportRole[] = [];
  for (const role of doc.roles) {
    if (role.assumed) continue;
    const start = partial(role.start) ?? partial(role.end);
    if (!start) continue; // no date at all: the profile cannot place it on a timeline
    const highlights = role.bullets.filter((b) => b.origin !== 'assumed').map((b) => b.text.trim()).filter(Boolean);
    const said = [role.title, ...highlights, ...(role.entries ?? []).flatMap((e) => [e.title, e.tech ?? ''])].join('\n');
    const tags = new Map<string, string>();
    for (const name of [...role.skills, ...skillsNamedIn(said, skills)]) tags.set(skillKey(name), name.trim());
    roles.push({
      company: role.company.trim(),
      title: role.title.trim(),
      ...(role.location?.trim() ? { location: role.location.trim() } : {}),
      start,
      end: partial(role.end),
      highlights: highlights.slice(0, 30),
      skills: [...tags.values()].slice(0, 50),
    });
  }

  const education: ImportEducation[] = doc.education
    .filter((e) => !e.assumed)
    .map((e) => {
      const start = partial(e.start ?? null);
      const end = partial(e.end ?? null);
      return {
        institution: e.institution.trim(),
        degree: e.degree.trim(),
        ...(e.field?.trim() ? { field: e.field.trim() } : {}),
        start,
        end,
        // `end: null` is "present" only when the file gave a start to be present from.
        current: e.end === null && Boolean(start),
      };
    });

  // The header: phone, place and links, as the file printed them (never the email: the account has it).
  let phone: string | undefined;
  let location: string | undefined;
  const links: ImportLink[] = [];
  for (const item of doc.header?.items ?? []) {
    const text = item.text.trim();
    const url = item.url && !/^(mailto|tel):/i.test(item.url) ? item.url : undefined;
    if (url) {
      const link = linkFrom(text, url);
      if (link && !links.some((l) => l.url === link.url)) links.push(link);
      continue;
    }
    if (new RegExp(EMAIL.source, 'i').test(text)) continue;
    const phoneMatch = text.match(new RegExp(PHONE.source));
    if (!phone && phoneMatch && isPhone(phoneMatch[0])) {
      phone = phoneMatch[0].trim();
      continue;
    }
    if (/^(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\/\S*$/i.test(text)) {
      const link = linkFrom(text, text);
      if (link && !links.some((l) => l.url === link.url)) links.push(link);
      continue;
    }
    if (!location && looksLikePlace(text)) location = text;
  }

  const latest = [...roles].sort((a, b) => (a.end === null ? 1 : 0) - (b.end === null ? 1 : 0) || a.start.date.localeCompare(b.start.date)).at(-1);
  const summary = own(doc.summary);
  const years = yearsAcross(roles, today);

  return {
    ...(doc.headline?.trim() ? { headline: doc.headline.trim() } : latest ? { headline: latest.title } : {}),
    ...(summary ? { bio: summary.text.trim() } : {}),
    ...(phone ? { phone } : {}),
    ...(location ? { location } : {}),
    ...(years !== undefined ? { years } : {}),
    links,
    skills,
    roles,
    education,
    certifications: doc.certifications.map((c) => ({ name: c.name.trim(), issuer: c.issuer?.trim() || 'Not stated' })),
    projects: doc.projects.map((p) => {
      const lines = [p.description?.trim(), p.tech?.trim() ? `Built with ${p.tech.trim()}` : undefined, ...p.bullets.filter((b) => b.origin !== 'assumed').map((b) => `• ${b.text.trim()}`)].filter(Boolean);
      return { name: p.name.trim(), ...(lines.length ? { description: lines.join('\n').slice(0, 4000) } : {}) };
    }),
  };
}

// ---------------------------------------------------------------------------------------------
// What it would change

interface CurrentProfile {
  headline: string | null;
  bio: string | null;
  phone: string | null;
  location: string | null;
  years: number | null;
  links: string[];
  skills: string[];
  roles: { id: string; company: string; title: string; start: string; location: string | null; responsibilities: string[]; skills: string[] }[];
  education: { id: string; institution: string; degree: string; field: string | null; start: string | null; end: string | null }[];
  certifications: string[];
  projects: string[];
}

export interface ImportPlan {
  changes: ResumeSyncChanges;
  fields: { headline?: string; bio?: string; phone?: string; location?: string; years_experience?: number };
  links: ImportLink[];
  skills: string[];
  newRoles: ImportRole[];
  roleUpdates: { id: string; location?: string; responsibilities?: string[]; addSkills: string[] }[];
  newEducation: ImportEducation[];
  educationUpdates: { id: string; field?: string; start?: Partial }[];
  certifications: { name: string; issuer: string }[];
  projects: { name: string; description?: string }[];
}

const urlKey = (url: string) => url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');
const blank = (value: string | null | undefined) => !value || !value.trim();

/** A degree's words, for matching "B.Tech CSE" (typed at onboarding) to "B.Tech in Computer Science". */
const degreeHead = (degree: string) => key(degree.replace(/\./g, '')).split(' ')[0] ?? '';

/** What filling `current` from `imp` would add and fill. Pure: the status and the write share it. */
export function planImport(current: CurrentProfile, imp: ResumeProfileImport): ImportPlan {
  const fields: ImportPlan['fields'] = {};
  const changed: ResumeSyncChanges['fields'] = [];
  const fill = <K extends keyof ImportPlan['fields']>(field: K, value: ImportPlan['fields'][K], change: ResumeSyncChanges['fields'][number]) => {
    fields[field] = value;
    changed.push(change);
  };
  if (imp.headline && blank(current.headline)) fill('headline', imp.headline.slice(0, 200), 'headline');
  if (imp.bio && blank(current.bio)) fill('bio', imp.bio.slice(0, 4000), 'summary');
  if (imp.phone && blank(current.phone)) fill('phone', imp.phone.slice(0, 40), 'phone');
  if (imp.location && blank(current.location)) fill('location', imp.location.slice(0, 200), 'location');
  if (imp.years !== undefined && current.years === null && imp.roles.length > 0) fill('years_experience', Math.min(70, imp.years), 'years');

  const haveLinks = new Set(current.links.map(urlKey));
  const links = imp.links.filter((l) => !haveLinks.has(urlKey(l.url)) && haveLinks.add(urlKey(l.url)));

  const haveSkills = new Set(current.skills.map(skillKey));
  const skills = imp.skills.filter((s) => !haveSkills.has(skillKey(s)) && haveSkills.add(skillKey(s)));

  const newRoles: ImportRole[] = [];
  const roleUpdates: ImportPlan['roleUpdates'] = [];
  const matched = new Set<string>();
  for (const role of imp.roles) {
    const same = current.roles.find(
      (r) =>
        !matched.has(r.id) &&
        key(r.company) === key(role.company) &&
        (key(r.title) === key(role.title) || r.start.slice(0, 7) === role.start.date.slice(0, 7)),
    );
    if (!same) {
      newRoles.push(role);
      continue;
    }
    matched.add(same.id);
    const tags = new Set(same.skills.map(skillKey));
    const update = {
      id: same.id,
      ...(blank(same.location) && role.location ? { location: role.location } : {}),
      ...(same.responsibilities.length === 0 && role.highlights.length > 0 ? { responsibilities: role.highlights } : {}),
      addSkills: role.skills.filter((s) => !tags.has(skillKey(s)) && tags.add(skillKey(s))),
    };
    if (update.location || update.responsibilities || update.addSkills.length) roleUpdates.push(update);
  }

  const newEducation: ImportEducation[] = [];
  const educationUpdates: ImportPlan['educationUpdates'] = [];
  const matchedSchools = new Set<string>();
  for (const school of imp.education) {
    const same = current.education.find(
      (e) =>
        !matchedSchools.has(e.id) &&
        (key(e.institution) === key(school.institution) ||
          // Onboarding asks the degree and the year, not always the school: the same degree
          // finished the same year is the same row.
          (degreeHead(e.degree) === degreeHead(school.degree) && Boolean(e.end) && e.end?.slice(0, 4) === school.end?.date.slice(0, 4))),
    );
    if (!same) {
      newEducation.push(school);
      continue;
    }
    matchedSchools.add(same.id);
    const update = { id: same.id, ...(blank(same.field) && school.field ? { field: school.field } : {}), ...(!same.start && school.start ? { start: school.start } : {}) };
    if (update.field || update.start) educationUpdates.push(update);
  }

  const haveCerts = new Set(current.certifications.map(key));
  const certifications = imp.certifications.filter((c) => !haveCerts.has(key(c.name)) && haveCerts.add(key(c.name)));
  const haveProjects = new Set(current.projects.map(key));
  const projects = imp.projects.filter((p) => !haveProjects.has(key(p.name)) && haveProjects.add(key(p.name)));

  return {
    changes: {
      roles: newRoles.length,
      education: newEducation.length,
      skills: skills.length,
      certifications: certifications.length,
      projects: projects.length,
      links: links.length,
      updates: roleUpdates.length + educationUpdates.length,
      fields: changed,
    },
    fields,
    links,
    skills,
    newRoles,
    roleUpdates,
    newEducation,
    educationUpdates,
    certifications,
    projects,
  };
}

// ---------------------------------------------------------------------------------------------
// The database side

type Marker = { versionId: string; decision: 'accepted' | 'declined' | 'auto'; at: string };

async function loadCurrent(tx: Tx, userId: string): Promise<CurrentProfile & { marker: Marker | null }> {
  const day = (column: string) => sql<string | null>`to_char(${sql.ref(column)}, 'YYYY-MM-DD')`;
  const [row, links, skills, roles, roleSkills, education, certifications, projects] = await Promise.all([
    tx.selectFrom('profiles').select(['headline', 'bio', 'phone', 'location', 'years_experience', 'preferences']).where('user_id', '=', userId).executeTakeFirstOrThrow(),
    tx.selectFrom('profile_links').select('url').where('user_id', '=', userId).execute(),
    tx.selectFrom('profile_skills').select('raw_name').where('user_id', '=', userId).execute(),
    tx.selectFrom('experience').select(['id', 'company', 'title', 'location', 'responsibilities', day('start_date').as('start')]).where('user_id', '=', userId).execute(),
    tx.selectFrom('experience_skills').select(['experience_id', 'raw_name']).where('user_id', '=', userId).execute(),
    tx.selectFrom('education').select(['id', 'institution', 'degree', 'field', day('start_date').as('start'), day('end_date').as('end')]).where('user_id', '=', userId).execute(),
    tx.selectFrom('certifications').select('name').where('user_id', '=', userId).execute(),
    tx.selectFrom('projects').select('name').where('user_id', '=', userId).execute(),
  ]);
  const marker = ((row.preferences ?? {}) as { resumeSync?: Marker }).resumeSync ?? null;
  return {
    headline: row.headline,
    bio: row.bio,
    phone: row.phone,
    location: row.location,
    years: row.years_experience,
    links: links.map((l) => l.url),
    skills: skills.map((s) => s.raw_name),
    roles: roles.map((r) => ({ id: r.id, company: r.company, title: r.title, start: r.start ?? '', location: r.location, responsibilities: r.responsibilities ?? [], skills: roleSkills.filter((s) => s.experience_id === r.id).map((s) => s.raw_name) })),
    education: education.map((e) => ({ id: e.id, institution: e.institution, degree: e.degree, field: e.field, start: e.start, end: e.end })),
    certifications: certifications.map((c) => c.name),
    projects: projects.map((p) => p.name),
    marker,
  };
}

/** The base resume's current version, read as the profile would take it. */
async function loadBase(tx: Tx, userId: string) {
  const base = await tx
    .selectFrom('resumes as r')
    .innerJoin('resume_versions as v', 'v.id', 'r.current_version_id')
    .select(['r.id', 'r.title', 'v.id as version_id', 'v.content'])
    .where('r.user_id', '=', userId)
    .where('r.is_base', '=', true)
    .where('r.doc_type', '=', 'resume')
    .where('r.trashed_at', 'is', null)
    .executeTakeFirst();
  if (!base) return null;
  const doc = canonicalResumeSchema.safeParse(base.content);
  if (!doc.success) return null;
  return { resumeId: base.id, title: base.title, versionId: base.version_id, read: readResumeForProfile(doc.data) };
}

async function statusOf(tx: Tx, userId: string): Promise<ResumeSyncStatus> {
  const base = await loadBase(tx, userId);
  if (!base) return { state: 'none' };
  const current = await loadCurrent(tx, userId);
  const plan = planImport(current, base.read);
  const about = { resumeId: base.resumeId, versionId: base.versionId, resumeTitle: base.title, changes: plan.changes };
  if (!current.marker) return { ...about, state: resumeSyncHasChanges(plan.changes) ? 'first' : 'current' };
  if (current.marker.versionId === base.versionId || !resumeSyncHasChanges(plan.changes)) return { ...about, state: 'current' };
  return { ...about, state: 'changed' };
}

export const getResumeSync = (db: Database, identity: Identity) => db.withUser(identity, (tx) => statusOf(tx, identity.userId));

async function applyPlan(tx: Tx, userId: string, plan: ImportPlan) {
  const provenance = 'parsed_confirmed' as const;
  if (Object.keys(plan.fields).length) await tx.updateTable('profiles').set(plan.fields).where('user_id', '=', userId).execute();

  const next = async (table: 'experience' | 'education' | 'profile_links' | 'profile_skills' | 'projects') => {
    const row = await tx.selectFrom(table).select(sql<number>`coalesce(max(sort_order) + 1, 0)`.as('next')).where('user_id', '=', userId).executeTakeFirst();
    return Number(row?.next ?? 0);
  };

  if (plan.skills.length) {
    const from = await next('profile_skills');
    await tx.insertInto('profile_skills').values(plan.skills.map((raw_name, i) => ({ user_id: userId, raw_name, sort_order: from + i, provenance }))).execute();
  }
  if (plan.links.length) {
    const from = await next('profile_links');
    await tx.insertInto('profile_links').values(plan.links.map((l, i) => ({ user_id: userId, label: l.label, url: l.url, kind: l.kind, sort_order: from + i }))).execute();
  }

  let order = await next('experience');
  for (const role of plan.newRoles) {
    const { id } = await tx
      .insertInto('experience')
      .values({
        user_id: userId,
        company: role.company.slice(0, 200),
        title: role.title.slice(0, 200),
        location: role.location ?? null,
        start_date: role.start.date,
        start_precision: role.start.precision,
        end_date: role.end?.date ?? null,
        end_precision: role.end?.precision ?? null,
        is_current: role.end === null,
        responsibilities: role.highlights,
        provenance,
        sort_order: order++,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    if (role.skills.length) await tx.insertInto('experience_skills').values(role.skills.map((raw_name) => ({ experience_id: id, user_id: userId, raw_name, provenance }))).execute();
  }
  for (const update of plan.roleUpdates) {
    const set = { ...(update.location ? { location: update.location } : {}), ...(update.responsibilities ? { responsibilities: update.responsibilities } : {}) };
    if (Object.keys(set).length) await tx.updateTable('experience').set(set).where('id', '=', update.id).where('user_id', '=', userId).execute();
    if (update.addSkills.length) await tx.insertInto('experience_skills').values(update.addSkills.map((raw_name) => ({ experience_id: update.id, user_id: userId, raw_name, provenance }))).execute();
  }

  order = await next('education');
  for (const school of plan.newEducation) {
    await tx
      .insertInto('education')
      .values({
        user_id: userId,
        institution: school.institution.slice(0, 200),
        degree: school.degree.slice(0, 200),
        field: school.field ?? null,
        start_date: school.start?.date ?? null,
        start_precision: school.start?.precision ?? null,
        end_date: school.current ? null : (school.end?.date ?? null),
        end_precision: school.current ? null : (school.end?.precision ?? null),
        is_current: school.current,
        provenance,
        sort_order: order++,
      })
      .execute();
  }
  for (const update of plan.educationUpdates) {
    await tx
      .updateTable('education')
      .set({ ...(update.field ? { field: update.field } : {}), ...(update.start ? { start_date: update.start.date, start_precision: update.start.precision } : {}) })
      .where('id', '=', update.id)
      .where('user_id', '=', userId)
      .execute();
  }

  if (plan.certifications.length) await tx.insertInto('certifications').values(plan.certifications.map((c) => ({ user_id: userId, name: c.name.slice(0, 200), issuer: c.issuer.slice(0, 200), provenance }))).execute();
  if (plan.projects.length) {
    const from = await next('projects');
    await tx.insertInto('projects').values(plan.projects.map((p, i) => ({ user_id: userId, name: p.name.slice(0, 200), description: p.description ?? null, provenance, sort_order: from + i }))).execute();
  }
}

/**
 * The yes (or the first fill) and the no. The version must still be the base's current one: a
 * question answered about a resume that has since changed again is refused, and asked afresh.
 */
export function decideResumeSync(db: Database, identity: Identity, { versionId, accept }: ResumeSyncDecision): Promise<LoadedProfile> {
  return write(db, identity, async (tx) => {
    const userId = identity.userId;
    // One fill at a time per person: two tabs answering at once must not add every row twice.
    await tx.selectFrom('profiles').select('user_id').where('user_id', '=', userId).forUpdate().executeTakeFirstOrThrow();
    const base = await loadBase(tx, userId);
    if (!base) throw errors.notFound('base resume');
    if (base.versionId !== versionId) throw errors.conflict('Your resume changed again. Have another look.');
    const current = await loadCurrent(tx, userId);
    if (accept) await applyPlan(tx, userId, planImport(current, base.read));
    const marker: Marker = { versionId, decision: accept ? (current.marker ? 'accepted' : 'auto') : 'declined', at: new Date().toISOString() };
    await tx
      .updateTable('profiles')
      .set({ preferences: sql`coalesce(preferences, '{}'::jsonb) || ${JSON.stringify({ resumeSync: marker })}::jsonb` })
      .where('user_id', '=', userId)
      .execute();
  });
}
