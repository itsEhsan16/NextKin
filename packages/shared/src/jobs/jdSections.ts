import type { RemoteType } from '../models';

/**
 * A job description read into its own sections (toreview §129, owner 2026-10-21: "a proper
 * detailed job description, with all the sections"). By code first: the JD's own headings, each
 * classified, with the lines under it, as the JD wrote them. Nothing is reworded or added (G13).
 * When the text has too few headings to read this way, the reading says so (`confidence: 'weak'`)
 * and the server asks a model to group the lines instead, every line checked against the text
 * (`pipeline/stages/jdSections.ts`).
 */

export type JdSectionKind =
  | 'overview'
  | 'about_company'
  | 'responsibilities'
  | 'requirements'
  | 'preferred'
  | 'benefits'
  | 'compensation'
  | 'location'
  | 'how_to_apply'
  | 'other';

export const JD_SECTION_KINDS: readonly JdSectionKind[] = ['overview', 'about_company', 'responsibilities', 'requirements', 'preferred', 'benefits', 'compensation', 'location', 'how_to_apply', 'other'];

export type JdSection = {
  kind: JdSectionKind;
  /** The JD's own heading; absent for the opening lines before any heading. */
  heading?: string;
  /** Prose lines, as written. */
  paragraphs: string[];
  /** Bulleted lines, without their bullet marks. */
  items: string[];
};

export type JdReading = {
  sections: JdSection[];
  /** A pay range as the text states it ("$120,000 – $150,000 a year"), verbatim. */
  salary?: string;
  workArrangement?: RemoteType;
  /** `weak`: fewer than two classified sections; the server may ask a model to group the lines. */
  confidence: 'strong' | 'weak';
  /** Who read it: these rules, or a model whose every line was found in the text. */
  by: 'rules' | 'model';
};

/** The words that name each kind of section, English and German. */
const KINDS: readonly [JdSectionKind, RegExp][] = [
  ['overview', /^(?:(?:the |about the )?(?:role|position|job|opportunity)(?: overview| summary| description)?|overview|summary|job (?:summary|description|overview)|position summary|description|die (?:rolle|position)|deine rolle)$/i],
  ['responsibilities', /^(?:(?:key |main |core |your )?(?:responsibilities|duties|tasks)|what you(?:'|’)ll (?:do|be doing|work on)|what you will (?:do|be doing)|in this role(?:,? you will)?|the work|your (?:impact|mission|day[- ]to[- ]day)|day[- ]to[- ]day|(?:deine |ihre )?aufgaben|das erwartet dich)$/i],
  ['preferred', /^(?:preferred(?: qualifications| skills| experience)?|nice[- ]to[- ]haves?|bonus(?: points)?|good to have|(?:it(?:'|’)s )?a plus(?: if)?|plus|desired(?: skills| qualifications)?|wünschenswert|von vorteil)$/i],
  ['requirements', /^(?:requirements?|qualifications?|minimum qualifications|basic qualifications|required (?:skills|qualifications|experience)|(?:skills|experience)(?: (?:and|&) (?:experience|qualifications|skills))?|what you(?:'|’)ll (?:need|bring)|what you bring|what we(?:'|’)re looking for|who you are|must[- ]haves?|about you|you have|your (?:profile|background|skills)|anforderungen|dein profil|ihr profil|das bringst du mit)$/i],
  ['benefits', /^(?:benefits?|perks(?: (?:and|&) benefits)?|benefits (?:and|&) perks|what we offer|why (?:join us|work (?:with|for) us|you(?:'|’)ll love (?:it|working) here)|our offer|we offer|what(?:'|’)s in it for you|wir bieten|das bieten wir|deine vorteile)$/i],
  ['compensation', /^(?:compensation|salary|pay|pay range|salary range|compensation (?:and|&) benefits|base (?:pay|salary)|gehalt|vergütung)$/i],
  ['location', /^(?:location|work(?:ing)? location|where you(?:'|’)ll work|work arrangement|remote(?: work)?|hybrid|standort|arbeitsort)$/i],
  ['how_to_apply', /^(?:how to apply|application process|to apply|next steps|interview process|our (?:hiring|interview) process|bewerbung|so bewirbst du dich)$/i],
  // Last: its "About …" catch-all must not take "About you" or "About the role".
  ['about_company', /^(?:about (?:us|the company|the team|[\p{L}\d&.' -]{2,40})|who we are|our (?:company|story|mission|team)|company (?:overview|description)|über uns|wer wir sind)$/iu],
  ['other', /^(?:equal (?:opportunity|employment).*|eeo.*|diversity.*|disclaimer|additional information|legal|notes?)$/i],
];

const BULLET = /^\s*(?:[-*•▪·●◦‣–]|\d{1,2}[.)])\s+/;
const clean = (line: string) => line.replace(/^#{1,6}\s+/, '').replace(/^\*\*(.+)\*\*$/, '$1').replace(/\s*:\s*$/, '').trim();

/** What kind of section a heading opens, or undefined when the line is no heading. */
export function headingKind(line: string): JdSectionKind | undefined {
  const text = clean(line);
  if (!text || text.length > 60) return undefined;
  for (const [kind, pattern] of KINDS) if (pattern.test(text)) return kind;
  return undefined;
}

/** A line that reads as a heading: a known one, a markdown or bold one, or a short "Label:". */
function asHeading(raw: string): { kind: JdSectionKind; heading: string } | undefined {
  if (BULLET.test(raw)) return undefined;
  const text = clean(raw);
  const kind = headingKind(raw);
  if (kind) return { kind, heading: text };
  const marked = /^#{1,6}\s+\S/.test(raw) || /^\*\*.+\*\*:?$/.test(raw.trim());
  const labelled = raw.trim().endsWith(':') && text.split(/\s+/).length <= 6;
  return marked || labelled ? { kind: 'other', heading: text } : undefined;
}

const SALARY =
  /(?:(?:[$€£₹]|USD|EUR|GBP|INR|CAD|AUD)\s?\d[\d,.]*\s?[kK]?)(?:\s?(?:-|–|—|to)\s?(?:(?:[$€£₹]|USD|EUR|GBP|INR|CAD|AUD)\s?)?\d[\d,.]*\s?[kK]?)?(?:\s*(?:per|\/|a|an)\s*(?:year|yr|annum|hour|hr|month))?/;

/** A pay range as the text states it, verbatim. */
export function salaryIn(text: string): string | undefined {
  return SALARY.exec(text)?.[0].trim();
}

/** Remote, hybrid or on-site, as the text says it. */
export function arrangementIn(text: string): RemoteType | undefined {
  if (/\bhybrid\b/i.test(text)) return 'hybrid';
  if (/\b(?:fully\s+)?remote\b/i.test(text)) return 'remote';
  if (/\b(?:on[-\s]?site|in[-\s]office)\b/i.test(text)) return 'onsite';
  return undefined;
}

/**
 * The JD's sections by its own headings. The opening lines before any heading are the overview,
 * less a first line that is the title. Sections of one kind that the JD splits are kept apart,
 * each under its own heading.
 */
export function readJdSections(rawText: string, title?: string): JdReading {
  const lines = rawText.split(/\r?\n/).map((l) => l.replace(/\s+$/, ''));
  const sections: JdSection[] = [];
  let current: JdSection = { kind: 'overview', paragraphs: [], items: [] };
  let first = true;
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const heading = asHeading(raw);
    if (heading) {
      if (current.paragraphs.length || current.items.length) sections.push(current);
      current = { kind: heading.kind, heading: heading.heading, paragraphs: [], items: [] };
      first = false;
      continue;
    }
    const text = raw.trim();
    // The first line is the title when it says the title, or is short and unpunctuated.
    if (first && (title ? text.toLowerCase() === title.toLowerCase() : text.length <= 80 && !/[.!?]$/.test(text))) {
      first = false;
      continue;
    }
    first = false;
    if (BULLET.test(raw)) current.items.push(text.replace(BULLET, '').trim());
    else current.paragraphs.push(text);
  }
  if (current.paragraphs.length || current.items.length) sections.push(current);

  const classified = sections.filter((s) => s.kind !== 'overview' && s.kind !== 'other').length;
  const salary = salaryIn(rawText);
  const workArrangement = arrangementIn(rawText);
  return {
    sections,
    ...(salary ? { salary } : {}),
    ...(workArrangement ? { workArrangement } : {}),
    confidence: classified >= 2 ? 'strong' : 'weak',
    by: 'rules',
  };
}

/** The lines of every section of these kinds, in the JD's order. */
export const linesOf = (reading: JdReading, ...kinds: JdSectionKind[]): string[] =>
  reading.sections.filter((s) => kinds.includes(s.kind)).flatMap((s) => [...s.paragraphs, ...s.items]);
