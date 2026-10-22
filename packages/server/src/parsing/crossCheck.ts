import type { ProfileDraft } from '@nextkin/shared/models/profile';
import { CANONICAL_SCHEMA_VERSION, type CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';

import { extraSectionsOf, layoutOf, roleEntries, skillGroupsOf, type CheckContext } from './crossCheckStructure';
import type { Extraction } from './extract';

/**
 * The cross-check: deterministic, and the only thing that decides what reaches the draft and the
 * document. The profile draft holds the facts (employers, dates, schools, skills). The document is
 * the resume itself as the library stores it (toreview §110.4): the same kept roles and schools,
 * plus the lines of the resume — the summary, each bullet, each project line — but only those the
 * file contains word for word (case, spacing and punctuation aside), each the user's own line. A
 * line the model reworded is left out and listed, never kept as if the user wrote it (G13).
 */

export interface Verdict {
  section: string;
  item: string;
  reason: string;
}

export interface Verified {
  draft: ProfileDraft;
  document: CanonicalResumeJson;
  rejected: Verdict[];
  flagged: Verdict[];
}

/** The longest line the document keeps as one (a summary longer is left out, not cut). */
const MAX_LINE = 600;
const NOT_IN_FILE = 'This line is not in your file word for word, so it was left out.';

const userLine = (id: string, text: string) => ({ id, text: text.trim(), evidence: [] as string[], origin: 'user' as const });

/** "2021-13" is no month: the year stands alone. */
const partial = (date: string | null): string | null => (date && /^\d{4}(-(0[1-9]|1[0-2]))?$/.test(date) ? date : date ? date.slice(0, 4) : null);

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const GERMAN_MONTHS = ['jan', 'feb', 'mär', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dez'];

/** Lower case, unify dashes and quotes, drop punctuation, collapse spaces. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[‐-―−]/g, '-')
    // Slashes stay: "06/2017" is how many resumes state a month.
    .replace(/[^\p{L}\p{N}+#./\- ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const tokens = (text: string) => normalise(text).split(' ').filter((t) => t.length >= 2);

/** Found when the phrase appears as written, or (almost) all of its words appear in the document. */
function found(phrase: string, source: string, sourceTokens: Set<string>, coverage: number): boolean {
  const p = normalise(phrase);
  if (!p) return false;
  if (source.includes(p)) return true;
  const words = tokens(phrase).filter((w) => w.length >= 3);
  if (words.length === 0) return false;
  return words.filter((w) => sourceTokens.has(w)).length / words.length >= coverage;
}

/** A YYYY or YYYY-MM date is stated when its year appears, and its month (if given) appears near it. */
function dateStated(date: string, source: string): boolean {
  const [year, month] = date.split('-');
  if (!year || !source.includes(year)) return false;
  if (!month) return true;
  const m = Number(month);
  const forms = [MONTHS[m - 1]!, GERMAN_MONTHS[m - 1]!, `${month}/${year}`, `${m}/${year}`, `${month}.${year}`, `${year}-${month}`, `${month}-${year}`];
  return forms.some((form) => {
    let at = source.indexOf(form);
    while (at >= 0) {
      if (form.includes(year) || source.slice(Math.max(0, at - 20), at + 30).includes(year)) return true;
      at = source.indexOf(form, at + 1);
    }
    return false;
  });
}

const iso = (date: string | null): string | undefined => (date ? (date.length === 4 ? `${date}-01-01` : `${date}-01`) : undefined);

export function crossCheck(extraction: Extraction, text: string): Verified {
  const source = normalise(text);
  const sourceTokens = new Set(source.split(' '));
  const rejected: Verdict[] = [];
  const flagged: Verdict[] = [];
  const skillFound = (skill: string) => found(skill, source, sourceTokens, 1);
  /** The lines the file contains as written; the rest are listed, never kept. */
  // A line goes in one place only: the same bullets read as a role's client project and again
  // as a project would print twice (toreview §111).
  const placed = new Set<string>();
  const keepLines = (lines: readonly string[], section: string): string[] =>
    lines.filter((line) => {
      const key = normalise(line);
      if (!key || line.trim().length > MAX_LINE || !source.includes(key)) {
        rejected.push({ section, item: line.slice(0, 120), reason: NOT_IN_FILE });
        return false;
      }
      if (placed.has(key)) {
        rejected.push({ section, item: line.slice(0, 120), reason: 'This line is already kept in another section.' });
        return false;
      }
      placed.add(key);
      return true;
    });
  const ctx: CheckContext = { found: (phrase, coverage) => found(phrase, source, sourceTokens, coverage), verbatim: (text) => Boolean(normalise(text)) && source.includes(normalise(text)), keepLines, rejected };

  /** A role's own lines, then its client projects' lines grouped as `entries`. */
  const roleBullets = (role: Extraction['roles'][number], k: number) => {
    const kept = keepLines(role.bullets, 'experience');
    if (kept.length > 12) rejected.push({ section: 'experience', item: `${role.title} at ${role.company}`.slice(0, 120), reason: `Only the first 12 of its ${kept.length} bullets are kept.` });
    const own = kept.slice(0, 12).map((line, j) => userLine(`u-b${k}-${j}`, line));
    const grouped = roleEntries(ctx, role.entries, k, own.length);
    return { bullets: [...own, ...grouped.bullets], ...(grouped.entries.length ? { entries: grouped.entries } : {}) };
  };

  const experiences: NonNullable<ProfileDraft['experiences']> = [];
  const roles: CanonicalResumeJson['roles'] = [];
  for (const role of extraction.roles) {
    const label = `${role.title} at ${role.company}`;
    if (!found(role.company, source, sourceTokens, 0.8)) {
      rejected.push({ section: 'experience', item: label, reason: 'The document does not name this employer.' });
      continue;
    }
    if (!dateStated(role.start, source)) {
      rejected.push({ section: 'experience', item: label, reason: `The document does not state the start date ${role.start}.` });
      continue;
    }
    if (role.end && !dateStated(role.end, source)) {
      rejected.push({ section: 'experience', item: label, reason: `The document does not state the end date ${role.end}.` });
      continue;
    }
    if (!found(role.title, source, sourceTokens, 0.6)) flagged.push({ section: 'experience', item: label, reason: 'The document words this title differently; check it.' });
    const skills = role.skills.filter((skill) => {
      if (skillFound(skill)) return true;
      rejected.push({ section: 'skills', item: `${skill} (${role.company})`, reason: 'The document does not mention this skill.' });
      return false;
    });
    experiences.push({
      id: '',
      company: role.company.trim(),
      title: role.title.trim(),
      startDate: iso(role.start)!,
      endDate: role.current ? undefined : iso(role.end),
      current: role.current || !role.end,
      skills,
      summary: role.summary ?? undefined,
    });
    const k = roles.length;
    roles.push({
      roleId: `upload-r${k}`,
      company: role.company.trim(),
      title: role.title.trim(),
      start: partial(role.start),
      end: role.current || !role.end ? null : partial(role.end),
      skills: skills.slice(0, 40),
      ...roleBullets(role, k),
    });
  }

  const entryTitles = new Set(roles.flatMap((r) => (r.entries ?? []).map((e) => normalise(e.title))));

  const education: NonNullable<ProfileDraft['education']> = [];
  const schools: CanonicalResumeJson['education'] = [];
  for (const school of extraction.education) {
    const label = `${school.degree}, ${school.institution}`;
    if (!found(school.institution, source, sourceTokens, 0.8)) {
      rejected.push({ section: 'education', item: label, reason: 'The document does not name this institution.' });
      continue;
    }
    const start = school.start && dateStated(school.start, source) ? school.start : null;
    const end = school.end && dateStated(school.end, source) ? school.end : null;
    if (!start && !end) {
      rejected.push({ section: 'education', item: label, reason: 'The document gives no dates for this; add it by hand with its dates.' });
      continue;
    }
    if ((school.start && !start) || (school.end && !end)) flagged.push({ section: 'education', item: label, reason: 'A date was left out: the document does not state it.' });
    education.push({ id: '', institution: school.institution.trim(), degree: school.degree.trim(), field: school.field ?? undefined, startDate: iso(start) ?? iso(end) ?? '', endDate: iso(end), current: !end });
    const gpa = school.gpa && ctx.verbatim(school.gpa) ? school.gpa.trim().slice(0, 60) : undefined;
    const place = school.location && ctx.verbatim(school.location) ? school.location.trim().slice(0, 120) : undefined;
    schools.push({ factId: `upload-e${schools.length}`, institution: school.institution.trim(), degree: school.degree.trim(), ...(school.field ? { field: school.field.trim() } : {}), start: partial(start), end: partial(end), ...(gpa ? { gpa } : {}), ...(place ? { location: place } : {}) });
  }

  const certifications: NonNullable<ProfileDraft['certifications']> = [];
  for (const cert of extraction.certifications) {
    if (!found(cert.name, source, sourceTokens, 0.8)) {
      rejected.push({ section: 'certifications', item: cert.name, reason: 'The document does not name this certification.' });
      continue;
    }
    certifications.push({ id: '', name: cert.name.trim(), issuer: cert.issuer?.trim() || 'Not stated', issuedOn: cert.issued && dateStated(cert.issued, source) ? iso(cert.issued) : undefined });
  }

  const skills = [...new Map(extraction.skills.filter((s) => {
    if (skillFound(s)) return true;
    rejected.push({ section: 'skills', item: s, reason: 'The document does not mention this skill.' });
    return false;
  }).map((s) => [normalise(s), s.trim()])).values()];

  const headline = extraction.headline && found(extraction.headline, source, sourceTokens, 0.6) ? extraction.headline.trim() : undefined;
  const summary = extraction.summary ? keepLines([extraction.summary], 'summary')[0] : undefined;

  const projects: CanonicalResumeJson['projects'] = [];
  for (const project of extraction.projects) {
    // A role's client project listed again as a project is the same work: kept once, in the role.
    if (entryTitles.has(normalise(project.name))) continue;
    if (!found(project.name, source, sourceTokens, 0.8)) {
      rejected.push({ section: 'projects', item: project.name, reason: 'The document does not name this project.' });
      continue;
    }
    const k = projects.length;
    const description = project.description ? keepLines([project.description], 'projects')[0] : undefined;
    projects.push({
      factId: `upload-p${k}`,
      name: project.name.trim(),
      ...(description ? { description: description.trim() } : {}),
      ...(project.tech && ctx.verbatim(project.tech) ? { tech: project.tech.trim().slice(0, 300) } : {}),
      ...(project.start && dateStated(project.start, source) ? { start: partial(project.start) } : {}),
      ...(project.end && dateStated(project.end, source) ? { end: partial(project.end) } : {}),
      bullets: keepLines(project.bullets, 'projects').slice(0, 8).map((line, j) => userLine(`u-p${k}-${j}`, line)),
    });
  }

  const skillGroups = skillGroupsOf(ctx, extraction.skillGroups, skillFound);
  const sections = extraSectionsOf(ctx, extraction.extraSections);
  const layout = layoutOf(ctx, extraction.sectionOrder, sections);
  const document: CanonicalResumeJson = {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    ...(headline ? { headline: headline.slice(0, 200) } : {}),
    ...(summary ? { summary: userLine('u-s', summary) } : {}),
    skills: skills.slice(0, 60).map((name, i) => ({ id: `u-k${i}`, name: name.slice(0, 120), evidence: [], origin: 'user' as const })),
    roles: roles.slice(0, 20),
    education: schools.slice(0, 10),
    certifications: certifications.slice(0, 20).map((c, i) => ({ factId: `upload-c${i}`, name: c.name, ...(c.issuer && c.issuer !== 'Not stated' ? { issuer: c.issuer } : {}) })),
    projects: projects.slice(0, 10),
    ...(skillGroups.length ? { skillGroups } : {}),
    ...(sections.length ? { sections } : {}),
    ...(layout ? { layout } : {}),
  };
  return { draft: { headline, skills, experiences, education, certifications }, document, rejected, flagged };
}
