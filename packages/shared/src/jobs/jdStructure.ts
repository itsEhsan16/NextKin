import type { EmploymentType, ExperienceLevel } from '../models/job';
import {
  JD_STRUCTURE_VERSION,
  type ApplicationKind,
  type EligibilityKind,
  type Importance,
  type JdFact,
  type JdIssue,
  type JdLocation,
  type JdQuote,
  type JdStructured,
  type LanguageLevel,
  type PayComponent,
  type ScheduleKind,
  type SkillCategory,
  type WorkMode,
} from '../models/jdStructured';
import { factKey, MAX_QUOTES, mergeFacts, readExperience, readPay, SENSITIVE } from './jdChecks';
import { haystackOf, locate, type Haystack } from './jdLocate';
import { dateIn, daysPerWeekIn } from './jdParse';

/**
 * A model's reading of a posting, as the extraction stage asks for it (toreview §153): every item
 * names the words it came from. Nothing here is trusted until `structureJd` has checked it.
 */
type Said = { text: string; quote: string };
export type JdModelReading = {
  title: Said | null;
  company: Said | null;
  department: Said | null;
  industry: Said | null;
  employmentType: { value: EmploymentType; quote: string } | null;
  /** Seniority may be read from context ("we need someone to lead…"): no quote, so interpreted. */
  seniority: { value: ExperienceLevel; quote: string | null } | null;
  openings: { value: number; quote: string } | null;
  referenceId: Said | null;
  summary: string | null;
  locations: (Said & { city: string | null; region: string | null; country: string | null })[];
  workModes: { value: WorkMode; quote: string }[];
  schedule: (Said & { kind: ScheduleKind })[];
  pay: { component: PayComponent; quote: string }[];
  negotiable: { quote: string } | null;
  experience: Said[];
  responsibilities: (Said & { group: string | null })[];
  skills: { name: string; quote: string; category: SkillCategory; importance: Importance }[];
  education: (Said & { importance: Importance })[];
  languages: { name: string; quote: string; importance: Importance; level: LanguageLevel | null }[];
  benefits: Said[];
  eligibility: (Said & { kind: EligibilityKind; sensitive: boolean })[];
  companyAbout: Said[];
  website: Said | null;
  application: (Said & { kind: ApplicationKind })[];
  extras: Said[];
  issues: { kind: 'conflict' | 'ambiguous'; field: string; note: string; quotes: string[] }[];
};

export type StructureOptions = {
  /** Skill names as the caller's taxonomy reads them: split, or [] to drop one that isn't a skill. */
  skillNames?: (name: string) => string[];
  /** Where a page said the posting closes (the link reader's `closesAt`). */
  closesAt?: string;
  /** Today, YYYY-MM-DD: an earlier deadline is flagged as expired. */
  today: string;
};

/** Same words, ignoring letter case and punctuation: a phrase inside its own quote. */
const within = (text: string, quote: string) =>
  ` ${factKey(quote)} `.includes(` ${factKey(text)} `);

/**
 * Checks a reading against its posting and builds the canonical structure. An item whose quote is
 * not in the text is dropped and counted; a value is the posting's words where the item is a line
 * (responsibilities), and the model's short name only where its quote contains it.
 */
export function structureJd(
  raw: string,
  reading: JdModelReading,
  options: StructureOptions,
): JdStructured {
  const hay = haystackOf(raw);
  let kept = 0;
  let dropped = 0;
  let merged = 0;
  const at = (quote: string | null | undefined): JdQuote | null => {
    const found = quote ? locate(hay, quote) : null;
    if (found) kept += 1;
    else dropped += 1;
    return found;
  };
  const fact = <T>(value: T, quote: JdQuote, status: JdFact['status'] = 'stated'): JdFact<T> => ({
    value,
    quotes: [quote],
    status,
  });
  /** A short name when its quote contains it; the quote itself otherwise. */
  const said = (s: Said, line = false): JdFact | null => {
    const q = at(s.quote);
    if (!q) return null;
    return fact(!line && within(s.text, q.text) ? s.text.trim() : q.text.trim(), q);
  };
  const one = (s: Said | null) => (s ? (said(s) ?? undefined) : undefined);
  const many = <S extends Said, X extends object>(
    items: readonly S[],
    extra: (s: S) => X,
    line = false,
  ) => {
    const out: (JdFact & X)[] = [];
    for (const s of items) {
      const f = said(s, line);
      if (f) out.push({ ...f, ...extra(s) });
    }
    const m = mergeFacts(out, (f) => factKey(f.value));
    merged += m.merged;
    return m.facts;
  };

  const issues: JdIssue[] = [];
  const identity: JdStructured['identity'] = {};
  const title = one(reading.title);
  if (title) identity.title = title;
  const company = one(reading.company);
  if (company) identity.company = company;
  const department = one(reading.department);
  if (department) identity.department = department;
  const industry = one(reading.industry);
  if (industry) identity.industry = industry;
  const reference = one(reading.referenceId);
  if (reference) identity.referenceId = reference;
  if (reading.employmentType) {
    const q = at(reading.employmentType.quote);
    if (q) identity.employmentType = fact(reading.employmentType.value, q);
  }
  if (reading.seniority) {
    const q = reading.seniority.quote ? locate(hay, reading.seniority.quote) : null;
    identity.seniority = {
      value: reading.seniority.value,
      quotes: q ? [q] : [],
      status: q ? 'stated' : 'interpreted',
    };
  }
  if (reading.openings && Number.isInteger(reading.openings.value) && reading.openings.value > 0) {
    const q = at(reading.openings.quote);
    if (q && q.text.includes(String(reading.openings.value)))
      identity.openings = fact(reading.openings.value, q);
  }

  const locations = many(reading.locations, () => ({})).map((f) => {
    const src = reading.locations.find(
      (l) => factKey(l.text) === factKey(f.value) || f.quotes[0]?.text.includes(l.quote),
    );
    const value: JdLocation = {
      label: f.value,
      ...(src?.city ? { city: src.city } : {}),
      ...(src?.region ? { region: src.region } : {}),
      ...(src?.country ? { country: src.country } : {}),
    };
    return { value, quotes: f.quotes, status: f.status };
  });

  const modes: JdFact<WorkMode>[] = [];
  for (const m of reading.workModes) {
    const q = at(m.quote);
    if (!q) continue;
    const twin = modes.find((x) => x.value === m.value);
    if (twin) twin.quotes.push(q);
    else modes.push(fact(m.value, q));
  }
  let workMode = modes[0];
  if (modes.some((m) => m.value === 'remote') && modes.some((m) => m.value === 'onsite')) {
    issues.push({
      kind: 'conflict',
      field: 'workMode',
      note: 'The listing says the job is remote in one place and in the office in another.',
      quotes: modes.flatMap((m) => m.quotes),
      by: 'rules',
    });
    workMode = workMode && { ...workMode, status: 'unclear' };
  }

  // Working days are a schedule, not a perk, unless the posting calls them one.
  const dayBenefits = reading.benefits.filter(
    (b) => daysPerWeekIn(b.quote) !== undefined && !/\bbenefits?\b|\bperks?\b/i.test(b.text),
  );
  const schedule = many(
    [...reading.schedule, ...dayBenefits.map((b) => ({ ...b, kind: 'days' as const }))],
    (s) => ({ kind: s.kind }),
  ).map((s): JdStructured['schedule'][number] => {
    const days =
      s.kind === 'days'
        ? s.quotes.map((q) => daysPerWeekIn(q.text)).find((d) => d !== undefined)
        : undefined;
    return days !== undefined ? { ...s, daysPerWeek: days } : s;
  });
  const daysMerged = mergeFacts(schedule, (s) =>
    s.daysPerWeek !== undefined ? `days:${s.daysPerWeek}` : `${s.kind}:${factKey(s.value)}`,
  );
  merged += daysMerged.merged;

  const payLines = reading.pay.flatMap((p) => {
    const q = at(p.quote);
    return q ? [{ component: p.component, quote: q }] : [];
  });
  const pay = readPay(payLines);
  merged += pay.merged;
  issues.push(...pay.issues);
  const negotiable = reading.negotiable ? at(reading.negotiable.quote) : null;

  const experienceLines = many(reading.experience, () => ({}));
  const experience = readExperience(experienceLines);
  issues.push(...experience.issues);

  const eligibility = many(reading.eligibility, (e) => ({ kind: e.kind, sensitive: false })).map(
    (e) => {
      const src = reading.eligibility.find(
        (x) =>
          e.quotes.some((q) => q.text.includes(x.quote.trim())) ||
          factKey(x.text) === factKey(e.value),
      );
      const sensitive =
        Boolean(src?.sensitive) ||
        ['age', 'gender'].includes(e.kind) ||
        SENSITIVE.test(e.quotes.map((q) => q.text).join(' '));
      return { ...e, sensitive };
    },
  );
  for (const e of eligibility.filter((x) => x.sensitive)) {
    issues.push({
      kind: 'sensitive',
      field: 'eligibility',
      note: `The employer lists this as a condition: “${e.quotes[0]?.text ?? e.value}”. Some places restrict conditions like this; it is shown as the listing states it.`,
      quotes: e.quotes,
      by: 'rules',
    });
  }

  const application = many(reading.application, (a) => ({ kind: a.kind }));
  const deadlines = [
    ...new Set(
      application
        .filter((a) => a.kind === 'deadline')
        .flatMap((a) => a.quotes.map((q) => dateIn(q.text)))
        .filter((d): d is string => Boolean(d)),
    ),
  ];
  if (deadlines.length > 1) {
    issues.push({
      kind: 'conflict',
      field: 'application',
      note: `The listing gives more than one closing date: ${deadlines.join(' and ')}.`,
      quotes: application.filter((a) => a.kind === 'deadline').flatMap((a) => a.quotes),
      by: 'rules',
    });
  }
  const closing = [options.closesAt?.slice(0, 10), ...deadlines]
    .filter((d): d is string => Boolean(d))
    .sort()[0];
  if (closing && closing < options.today) {
    issues.push({
      kind: 'expired',
      field: 'application',
      note: `This listing said it closes on ${closing}, which has passed. It may no longer be open.`,
      quotes: application.filter((a) => a.kind === 'deadline').flatMap((a) => a.quotes),
      by: 'rules',
    });
  }

  const skills: JdStructured['skills'] = [];
  for (const s of reading.skills) {
    const q = at(s.quote);
    if (!q) continue;
    const names = !within(s.name, q.text)
      ? []
      : options.skillNames
        ? options.skillNames(s.name)
        : [s.name.trim()];
    // Quoted, but not a skill named in its own quote: dropped and counted like an unquoted one.
    if (names.length === 0) {
      kept -= 1;
      dropped += 1;
    }
    for (const name of names)
      skills.push({ ...fact(name, q), category: s.category, importance: s.importance });
  }
  // A skill asked for twice keeps its strongest importance and every quote.
  const skillMerge = mergeFacts(skills, (s) => factKey(s.value));
  merged += skillMerge.merged;
  for (const s of skillMerge.facts) {
    if (skills.some((x) => factKey(x.value) === factKey(s.value) && x.importance === 'required'))
      s.importance = 'required';
  }

  for (const i of reading.issues) {
    const quotes = i.quotes.map((q) => locate(hay, q)).filter((q): q is JdQuote => q !== null);
    if (quotes.length === 0 || quotes.length < i.quotes.length) continue;
    const dup = issues.some(
      (x) => x.field === i.field && x.quotes.some((q) => quotes.some((p) => q.start === p.start)),
    );
    if (!dup)
      issues.push({
        kind: i.kind,
        field: i.field,
        note: i.note.trim().slice(0, 400),
        quotes,
        by: 'model',
      });
  }

  const website = one(reading.website);
  return {
    schemaVersion: JD_STRUCTURE_VERSION,
    identity,
    ...(reading.summary?.trim() ? { summary: reading.summary.trim().slice(0, 600) } : {}),
    locations,
    ...(workMode ? { workMode } : {}),
    schedule: daysMerged.facts,
    compensation: {
      ...pay.compensation,
      ...(negotiable ? { negotiable: fact(true, negotiable) } : {}),
    },
    experience: { ...experience.experience, lines: experienceLines },
    responsibilities: many(
      reading.responsibilities,
      (r) => (r.group?.trim() ? { group: r.group.trim() } : {}),
      true,
    ),
    skills: skillMerge.facts,
    education: many(reading.education, (e) => ({ importance: e.importance })),
    languages: many(
      reading.languages.map((l) => ({
        text: l.name,
        quote: l.quote,
        importance: l.importance,
        level: l.level,
      })),
      (l) => ({ importance: l.importance, ...(l.level ? { level: l.level } : {}) }),
    ),
    benefits: many(
      reading.benefits.filter((b) => !dayBenefits.includes(b)),
      () => ({}),
    ),
    eligibility,
    company: {
      about: many(reading.companyAbout, () => ({}), true),
      ...(website ? { website } : {}),
    },
    application,
    extras: many(reading.extras, () => ({}), true),
    issues: issues.slice(0, 30).map((i) => ({ ...i, quotes: i.quotes.slice(0, MAX_QUOTES) })),
    stats: { kept, dropped, merged },
  };
}

export type { Haystack };
