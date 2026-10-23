import type { Job } from '@/data/models';
import type { JdDraft, JdInput } from '@/data/models/jd';

/**
 * NextKin V2 spec §7.5 — the mock's JD extractor: pasted text, an uploaded file or a job listing
 * in, one editable draft out. No artboard covers this flow (plan §8, phase 9).
 *
 * Everything here is pure. Ids and timestamps arrive in `ctx`, so the same input always yields
 * the same draft and the repo, not this file, decides what a new draft is called.
 */

export type JdExtractContext = {
  jobs: Job[];
  dictionary: readonly string[];
  id: string;
  now: string;
};

/** A pasted first line can be a whole sentence; the title field is a title. */
const MAX_TITLE = 80;
const UNTITLED = 'Untitled job description';

/** Dictionary entries that name a tool rather than a practice, so the draft can list both. */
const TOOL_NAMES: readonly string[] = [
  'figma',
  'storybook',
  'jira',
  'confluence',
  'mixpanel',
  'amplitude',
  'sql',
  'html',
  'css',
  'javascript',
  'typescript',
  'react',
  'react native',
];

/** Share of the mentioned skills read as required when the text does not say (V2 §7.5). */
const REQUIRED_SHARE = 0.6;

const LABELLED_COMPANY = /^[ \t]*company[ \t]*[-–—:][ \t]*(.+)$/im;
const AT_COMPANY = /\bat\s+([A-Z][\w&.' -]+)/;
// Anchored to the start of a line: these words are headings only when they open one. Loose in
// the middle of a sentence they invert the split — "a degree is not required … X is preferred"
// would read as a must-have section — so mid-sentence prose falls back to the 60% rule instead.
const MUST_HEADING = /^[ \t]*(?:must[- ]?haves?|required|requirements)\b/im;
const NICE_HEADING = /^[ \t]*(?:nice[- ]?to[- ]?haves?|preferred)\b/im;
const BULLET = /^[-*•·–—]\s+/;
const YOU_WILL = /\byou(?:['’]ll| will)\b/i;

/** Dictionary entries carry regex characters ("a/b testing"). */
const escapeRe = (value: string): string => value.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

type SkillMatch = { entry: string; text: string; start: number; end: number };

/**
 * Dictionary entries the text mentions, in order of first appearance and de-duplicated. The
 * surface form is kept, so "React Native" comes back as the JD wrote it, and a match sitting
 * inside a longer one is dropped — "React Native" must not also report "React".
 */
function findSkills(text: string, dictionary: readonly string[]): SkillMatch[] {
  const found: SkillMatch[] = [];
  for (const entry of dictionary) {
    const hit = new RegExp(`\\b${escapeRe(entry)}\\b`, 'i').exec(text);
    if (!hit) continue;
    found.push({ entry, text: hit[0], start: hit.index, end: hit.index + hit[0].length });
  }
  found.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: SkillMatch[] = [];
  for (const match of found) {
    if (!kept.some((other) => other.start <= match.start && other.end >= match.end)) {
      kept.push(match);
    }
  }
  return kept;
}

/**
 * The company, or nothing. A labelled "Company — X" line beats an inferred "at X" because it is
 * stated rather than read between the lines; when neither is there the draft leaves the field
 * empty instead of guessing, and the review screen asks.
 */
function findCompany(text: string): string | undefined {
  const labelled = LABELLED_COMPANY.exec(text)?.[1]?.trim();
  if (labelled) return labelled;
  const inferred = AT_COMPANY.exec(text)?.[1]?.trim();
  if (!inferred) return undefined;
  // The capture runs on past the name ("at Stripe in Bengaluru"), so it stops at the first word
  // that is not capitalised: a company name is, the sentence carrying it is not.
  const words: string[] = [];
  for (const word of inferred.split(/\s+/)) {
    if (!/^[A-Z0-9]/.test(word)) break;
    words.push(word);
  }
  const name = words
    .join(' ')
    .replace(/[-.,;:'&]+$/, '')
    .trim();
  return name.length > 0 ? name : undefined;
}

function firstLineTitle(text: string): string {
  const line = text
    .split('\n')
    .map((value) => value.trim())
    .find((value) => value.length > 0);
  if (!line) return UNTITLED;
  return line.length <= MAX_TITLE ? line : line.slice(0, MAX_TITLE).trimEnd();
}

/** Bulleted lines, plus the "you will" sentences a JD uses in place of bullets. */
function findResponsibilities(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => BULLET.test(line) || YOU_WILL.test(line))
    .map((line) => line.replace(BULLET, '').trim())
    .filter((line) => line.length > 0);
}

/** The nearest heading above a skill decides which list it lands in. */
const underNiceHeading = (at: number, mustAt: number, niceAt: number): boolean => {
  const must = mustAt >= 0 && mustAt < at ? mustAt : -1;
  const nice = niceAt >= 0 && niceAt < at ? niceAt : -1;
  return nice > must;
};

/**
 * Required vs preferred. A description that states the split ("Must have" / "Nice to have") is
 * taken at its word; one that does not falls back to reading the first 60% of what it mentions
 * as required, because a JD leads with what it cannot do without.
 */
function splitSkills(text: string, skills: SkillMatch[]): [string[], string[]] {
  const mustAt = MUST_HEADING.exec(text)?.index ?? -1;
  const niceAt = NICE_HEADING.exec(text)?.index ?? -1;
  if (mustAt >= 0 && niceAt >= 0 && mustAt !== niceAt) {
    const required: string[] = [];
    const preferred: string[] = [];
    for (const skill of skills) {
      (underNiceHeading(skill.start, mustAt, niceAt) ? preferred : required).push(skill.text);
    }
    return [required, preferred];
  }
  const names = skills.map((skill) => skill.text);
  const cut = Math.ceil(names.length * REQUIRED_SHARE);
  return [names.slice(0, cut), names.slice(cut)];
}

/** Everything an extraction reads out of free text; the caller adds identity and origin. */
type TextFields = Pick<
  JdDraft,
  'title' | 'company' | 'requiredSkills' | 'preferredSkills' | 'responsibilities' | 'tools'
>;

function fromText(text: string, dictionary: readonly string[]): TextFields {
  const skills = findSkills(text, dictionary);
  const [requiredSkills, preferredSkills] = splitSkills(text, skills);
  // Spread rather than write `company: undefined`: drafts are stored through a JSON round trip,
  // which drops undefined-valued keys, so an absent company has to be an absent key here too.
  const company = findCompany(text);
  return {
    title: firstLineTitle(text),
    ...(company ? { company } : {}),
    requiredSkills,
    preferredSkills,
    responsibilities: findResponsibilities(text),
    tools: skills.filter((skill) => TOOL_NAMES.includes(skill.entry)).map((skill) => skill.text),
  };
}

/**
 * A listing is already structured, so nothing is inferred: the tags the dictionary knows are the
 * required skills and the rest are preferred, and `rawText` is the listing rebuilt as the text
 * the user would otherwise have pasted.
 */
function fromJob(
  job: Job,
  dictionary: readonly string[],
): Omit<JdDraft, 'id' | 'source' | 'createdAt'> {
  const known = (tag: string): boolean => dictionary.includes(tag.toLowerCase());
  return {
    title: job.title,
    company: job.company,
    location: job.location,
    experienceLevel: job.experienceLevel,
    requiredSkills: job.tags.filter(known),
    preferredSkills: job.tags.filter((tag) => !known(tag)),
    responsibilities: job.responsibilities,
    tools: job.tags.filter((tag) => TOOL_NAMES.includes(tag.toLowerCase())),
    domain: job.companyIndustry,
    rawText: [
      `${job.title} at ${job.company} — ${job.location}`,
      '',
      job.description,
      '',
      'What you will do',
      ...job.responsibilities.map((line) => `- ${line}`),
      '',
      'Requirements',
      ...job.requirements.map((line) => `- ${line}`),
    ].join('\n'),
    jobId: job.id,
  };
}

/**
 * There is no PDF or DOCX parser in Expo Go and nothing to send an upload to, so the mock does
 * not parse the file: it keeps the file name as the title and extracts this fixed body instead.
 * That is a stand-in, not a parse, and it stays visible as `rawText` so the review screen shows
 * the user exactly what was read.
 */
const SAMPLE_FILE_TEXT = [
  'Product Designer at Freshworks, Bengaluru (Hybrid)',
  '',
  // One sentence, one line: `findResponsibilities` reads line by line, so hard-wrapping this
  // would file half a sentence as a responsibility and drop the rest.
  "You'll design onboarding and billing for a product 60,000 businesses run on, working with two engineers and a researcher.",
  '',
  'Must have',
  '- Strong Figma craft and fast prototyping',
  '- Experience building design systems and design tokens',
  '- Comfortable running usability testing with customers',
  '',
  'Nice to have',
  '- Accessibility and WCAG know-how',
  '- Reading product analytics in Mixpanel',
].join('\n');

const fileTitle = (name: string): string => {
  const stem = name.replace(/\.[a-z0-9]+$/i, '').trim();
  if (!stem) return UNTITLED;
  return stem.length <= MAX_TITLE ? stem : stem.slice(0, MAX_TITLE).trimEnd();
};

/** Extracts one draft. Throws on an unknown job id; the repo turns that into a user-facing error. */
export function extractJdDraft(input: JdInput, ctx: JdExtractContext): JdDraft {
  const base = { id: ctx.id, source: input.source, createdAt: ctx.now };

  if (input.source === 'job') {
    const job = ctx.jobs.find((candidate) => candidate.id === input.jobId);
    if (!job) throw new Error(`No job with id "${input.jobId}"`);
    return { ...base, ...fromJob(job, ctx.dictionary) };
  }

  const text = input.source === 'paste' ? input.text : SAMPLE_FILE_TEXT;
  const draft: JdDraft = { ...base, ...fromText(text, ctx.dictionary), rawText: text };
  return input.source === 'file' ? { ...draft, title: fileTitle(input.file.name) } : draft;
}
