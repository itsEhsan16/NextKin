import type { JdDraft, JdMatch, Job, RemoteType } from '../models';
import { linesOf, readJdSections, type JdReading } from './jdSections';

/**
 * A job description shown as a job (toreview §110): the web job page's sections (724:2) read a
 * `Job`, so a pasted, uploaded or linked JD gets one, built only from what its reading found. The
 * `Job` type wants a value in every fact; `known` says which ones the JD actually stated, so the
 * page leaves the defaulted ones out rather than printing a guess.
 */
export type JobFactsKnown = {
  company: boolean;
  location: boolean;
  remote: boolean;
  employmentType: boolean;
  experienceLevel: boolean;
  /** A years range the text states ("3–5 years of experience"). */
  years: boolean;
};

/** Remote, hybrid or on-site, when the text says so; null when it does not. */
export function remoteFromText(text: string): RemoteType | null {
  if (/\bhybrid\b/i.test(text)) return 'hybrid';
  if (/\b(?:fully\s+)?remote\b/i.test(text)) return 'remote';
  if (/\b(?:on[-\s]?site|in[-\s]office)\b/i.test(text)) return 'onsite';
  return null;
}

/** "3–5 years", "3 to 5 years" in the text: a range the page can print as stated. */
export function yearsFromText(text: string): { min: number; max: number } | null {
  const m = /\b(\d{1,2})\s*(?:-|–|—|to)\s*(\d{1,2})\s*\+?\s*(?:years|yrs)\b/i.exec(text);
  if (!m) return null;
  const min = Number(m[1]);
  const max = Number(m[2]);
  return max >= min && max <= 40 ? { min, max } : null;
}

/** A heading that opens what the job requires. */
const REQUIRED_HEADING =
  /^(?:requirements?|qualifications?|minimum qualifications|basic qualifications|required skills|skills(?: and experience)?|what you(?:'|’)ll (?:need|bring)|what you bring|what we(?:'|’)re looking for|who you are|must[- ]haves?|about you|your profile|anforderungen|dein profil|ihr profil)\s*:?$/i;
/** A heading that opens what it would merely like: it ends the required lines. */
const PREFERRED_HEADING =
  /^(?:preferred(?: qualifications| skills)?|nice[- ]to[- ]haves?|bonus(?: points)?|good to have|it(?:'|’)s a plus if|plus|wünschenswert)\s*:?$/i;
/** The other sections a JD has; an unbulleted line like "Strong SQL skills" is not one of them. */
const OTHER_HEADING =
  /^(?:responsibilities|key responsibilities|what you(?:'|’)ll do|the role|about the role|about (?:us|the team|the company)|benefits|perks|what we offer|why (?:join us|work with us)|our offer|compensation|salary|location|how to apply|equal opportunity.*|aufgaben|deine aufgaben|wir bieten|benefits & perks)\s*:?$/i;
const BULLET = /^\s*(?:[-*•▪·●◦]|\d+[.)])/;
const isHeading = (line: string) =>
  PREFERRED_HEADING.test(line) ||
  OTHER_HEADING.test(line) ||
  (!BULLET.test(line) && line.endsWith(':') && line.split(' ').length <= 6);
const bullet = (line: string) => line.replace(/^\s*(?:[-*•▪·●◦]|\d+[.)])\s*/, '').trim();

/**
 * The lines under the JD's own qualifications heading, as it wrote them: the page's "Required"
 * list. A nice-to-have heading, or any other heading, ends it. Empty when the text has no such
 * heading; the caller falls back to the skills read.
 */
export function qualificationLines(rawText: string, max = 12): string[] {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim());
  const out: string[] = [];
  let inside = false;
  for (const line of lines) {
    if (!line) continue;
    if (REQUIRED_HEADING.test(line)) {
      inside = true;
      continue;
    }
    if (inside && isHeading(line)) {
      inside = false;
      continue;
    }
    if (inside) {
      const text = bullet(line);
      if (text.length >= 3) out.push(text.slice(0, 400));
      if (out.length >= max) break;
    }
  }
  return out;
}

/** The first paragraph of prose: what the team does, as the page's summary line. */
function descriptionOf(rawText: string, title: string): string {
  const prose = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 60 && l !== title && !REQUIRED_HEADING.test(l) && !isHeading(l));
  return (prose ?? '').slice(0, 600);
}

const hostOf = (url: string | undefined) => {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

export function jobFromJd(
  draft: JdDraft,
  match?: JdMatch | null,
): { job: Job; known: JobFactsKnown; reading: JdReading } {
  // The JD in its sections (toreview §129): the server's model grouping when it made one.
  const reading = draft.reading ?? readJdSections(draft.rawText, draft.title);
  const overview = linesOf(reading, 'overview').join('\n');
  const benefits = linesOf(reading, 'benefits');
  const about = linesOf(reading, 'about_company').join('\n');
  // A line the reading files under another section (benefits, requirements, pay…) is that section's,
  // so it is not shown again as a duty; with none left, the reading's own duties stand in.
  const key = (line: string) => line.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const elsewhere = new Set(
    reading.sections
      .filter((s) => s.kind !== 'overview' && s.kind !== 'responsibilities' && s.kind !== 'other')
      .flatMap((s) => [...s.paragraphs, ...s.items])
      .map(key),
  );
  const duties = draft.responsibilities.filter((r) => !elsewhere.has(key(r)));
  const responsibilities = duties.length ? duties : linesOf(reading, 'responsibilities');
  const skills = [...new Set([...draft.requiredSkills, ...draft.preferredSkills])];
  const lines = qualificationLines(draft.rawText);
  const remote = remoteFromText(`${draft.location ?? ''}\n${draft.rawText}`) ?? reading.workArrangement ?? null;
  const years = yearsFromText(draft.rawText);
  const site = hostOf(draft.sourceUrl);
  const job: Job = {
    id: draft.id,
    title: draft.title,
    company: draft.company ?? site,
    companyIndustry: draft.domain ?? '',
    companySize: '',
    companyWebsite: site,
    location: draft.location ?? '',
    remote: remote ?? 'onsite',
    employmentType: draft.employmentType ?? 'full_time',
    experienceLevel: draft.experienceLevel ?? 'mid',
    ...(years ? { experienceYears: years } : {}),
    postedAt: draft.createdAt,
    source: 'manual',
    ...(draft.sourceUrl ? { sourceUrl: draft.sourceUrl, applyUrl: draft.sourceUrl } : {}),
    description: overview ? overview.slice(0, 1200) : descriptionOf(draft.rawText, draft.title),
    ...(benefits.length ? { benefits } : {}),
    ...(about ? { companyAbout: about.slice(0, 1200) } : {}),
    responsibilities,
    // Only lines the text states; the skills are their own lists, never repeated here.
    requirements: lines,
    ...(draft.domain ? { industries: [draft.domain] } : {}),
    tags: skills,
    isSaved: false,
    isPick: false,
    isTodaysPick: false,
    relevanceRank: Number.MAX_SAFE_INTEGER,
    ...(match ?? {}),
  };
  return {
    job,
    reading,
    known: {
      company: Boolean(draft.company),
      location: Boolean(draft.location),
      remote: remote !== null,
      employmentType: Boolean(draft.employmentType),
      experienceLevel: Boolean(draft.experienceLevel),
      years: years !== null,
    },
  };
}
