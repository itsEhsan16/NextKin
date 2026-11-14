import { createHash } from 'node:crypto';

import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { resolveSkill } from '@nextkin/engines/normalizer';
import { legacyFields, type JdLegacyFields } from '@nextkin/shared/jobs/jdLegacy';
import type { JdReading } from '@nextkin/shared/jobs/jdSections';
import { haystackOf, locate } from '@nextkin/shared/jobs/jdLocate';
import { structureJd } from '@nextkin/shared/jobs/jdStructure';
import type { JdStructured } from '@nextkin/shared/models/jdStructured';
import { jdStructuredSchema } from '@nextkin/shared/schemas/jdStructured';
import { z } from 'zod';

import type { AiGateway, CallContext, CallMeta } from '../../ai/gateway';
import type { KvCache } from '../../cache/kv';
import type { PromptVersion } from '../../services/prompts';

/**
 * JD extraction (ImBackendImplementationPlan P9-01; V2 §7.5). The model reads a job description
 * into typed fields on the fast tier, and every requirement it returns must carry a **quote** that
 * is found, verbatim, in the text. A requirement whose quote is not there, or whose words are not in
 * its own quote, is dropped and counted: nothing the JD does not say reaches generation or scoring.
 * A company or title the text does not contain is dropped the same way.
 *
 * Extractions are cached for 30 days by the hash of the normalised text and the prompt version
 * (`jd:<version>:<hash>`), so the same JD pasted twice makes one model call (§9.11).
 */

// Duties are copied whole, and a posting's duty lines can run past 200 characters (toreview §159).
const quote = z.string().trim().min(1).max(600);
const said = z.object({ text: z.string().trim().min(1).max(600), quote });
const importance = z.enum(['required', 'preferred']);

/**
 * What the model returns (toreview §153): the posting in its canonical places, every item quoting
 * the words it came from. Code then checks each quote against the text, reads the numbers from the
 * quotes itself, merges repeats and flags contradictions (`@nextkin/shared/jobs/jdStructure`).
 */
export const jdExtractionSchema = z.object({
  language: z.enum(['en', 'de', 'other']),
  title: said.nullable(),
  company: said.nullable(),
  department: said.nullable(),
  industry: said.nullable(),
  employmentType: z.object({ value: z.enum(['full_time', 'part_time', 'contract', 'internship', 'freelance']), quote }).nullable(),
  seniority: z.object({ value: z.enum(['entry', 'mid', 'senior', 'lead']), quote: quote.nullable() }).nullable(),
  openings: z.object({ value: z.number().int(), quote }).nullable(),
  referenceId: said.nullable(),
  summary: z.string().trim().max(600).nullable(),
  locations: z.array(said.extend({ city: z.string().max(120).nullable(), region: z.string().max(120).nullable(), country: z.string().max(120).nullable() })).max(10),
  workModes: z.array(z.object({ value: z.enum(['onsite', 'remote', 'hybrid', 'field', 'flexible']), quote })).max(6),
  schedule: z.array(said.extend({ kind: z.enum(['days', 'hours', 'shift', 'weekends', 'overtime', 'travel', 'joining', 'other']) })).max(12),
  pay: z.array(z.object({ component: z.enum(['base', 'fixed', 'variable', 'incentive', 'bonus', 'total', 'unknown']), quote })).max(8),
  negotiable: z.object({ quote }).nullable(),
  experience: z.array(said).max(10),
  responsibilities: z.array(said.extend({ group: z.string().max(80).nullable() })).max(40),
  skills: z.array(z.object({ name: z.string().trim().min(1).max(120), quote, category: z.enum(['language', 'framework', 'database', 'cloud', 'tool', 'api', 'domain', 'soft', 'other']), importance })).max(100),
  education: z.array(said.extend({ importance })).max(10),
  languages: z.array(z.object({ name: z.string().trim().min(1).max(60), quote, importance, level: z.enum(['basic', 'intermediate', 'advanced', 'fluent', 'native']).nullable() })).max(8),
  benefits: z.array(said).max(30),
  eligibility: z.array(said.extend({ kind: z.enum(['age', 'work_authorization', 'location', 'gender', 'background_check', 'other']), sensitive: z.boolean() })).max(12),
  companyAbout: z.array(said).max(12),
  website: said.nullable(),
  application: z.array(said.extend({ kind: z.enum(['method', 'url', 'email', 'deadline', 'documents', 'process']) })).max(12),
  extras: z.array(said).max(20),
  issues: z.array(z.object({ kind: z.enum(['conflict', 'ambiguous']), field: z.string().max(40), note: z.string().max(400), quotes: z.array(quote).min(1).max(4) })).max(10),
  // Version 7 (toreview §206): what the text is, before anything is taken from it. Optional, so a
  // reading made by an earlier prompt still validates.
  page: z
    .object({ kind: z.enum(['single_job', 'several_jobs', 'closed', 'not_a_job']), quote: quote.nullable(), jobTitles: z.array(z.string().trim().min(1).max(160)).max(6) })
    .nullable()
    .optional(),
});
export type JdExtraction = z.infer<typeof jdExtractionSchema>;

/** What generation and the page read: the flat lists every consumer knows, and the structure. */
export interface VerifiedJd extends Omit<JdLegacyFields, 'softSkills'> {
  language: JdExtraction['language'];
  softSkills?: string[];
  stats: { kept: number; dropped: number; droppedItems: string[] };
  /** The posting understood (toreview §153). */
  structured?: JdStructured;
  /** The JD's sections as a model grouped them, when the rules could not (toreview §129). */
  reading?: JdReading;
  /** When the page it was read from says it closes (toreview §144.3). */
  closesAt?: string;
  /** What the text turned out to be, where the model said so and code could confirm it (§206). */
  page?: PageVerdict;
}

/**
 * The model's view of what it was handed, kept only where the text bears it out (G14): a list of
 * jobs needs three of its job titles found in the text, and a closed posting needs the words that
 * say so. "Not a job" has nothing to quote; the caller believes it only when the reading is empty.
 */
export type PageVerdict = { kind: 'several_jobs' } | { kind: 'closed'; note: string } | { kind: 'not_a_job' };

const SAYS_CLOSED = /closed|expired|no longer|filled|not (?:available|accepting)|unavailable|removed|taken down|archived|nicht mehr|geschlossen|besetzt/i;
const TITLES_FOR_A_LIST = 3;

export function pageVerdict(raw: string, page: JdExtraction['page']): PageVerdict | undefined {
  if (!page || page.kind === 'single_job') return undefined;
  if (page.kind === 'not_a_job') return { kind: 'not_a_job' };
  const hay = haystackOf(raw);
  if (page.kind === 'several_jobs') {
    const titles = new Set(page.jobTitles.filter((title) => locate(hay, title)).map((title) => normalise(title)));
    return titles.size >= TITLES_FOR_A_LIST ? { kind: 'several_jobs' } : undefined;
  }
  const said = page.quote ? locate(hay, page.quote) : null;
  return said && said.text.length <= 300 && SAYS_CLOSED.test(said.text) ? { kind: 'closed', note: said.text.trim() } : undefined;
}

export const CACHE_DAYS = 30;

/** Lower case, one space, plain quotes and dashes: how quotes are compared with the text. */
export const normalise = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Text as stored (toreview §112): a "?" between two letters is a hyphen the source lost in
 * copying ("Full?Stack", "end?to?end"); English never writes one there.
 */
export const repairText = (text: string): string => text.replace(/(?<=\p{L})\?(?=\p{L})/gu, '-');

export const contentHash = (text: string): string => createHash('sha256').update(normalise(text)).digest('hex');

/**
 * A skill is a named skill or technology, not a qualification sentence (toreview §110). A degree,
 * a years-of-experience line or anything longer than six words is not one, so it never reaches
 * the skill lists the match, the comparison and tailoring count, whatever the model returned.
 */
const NOT_A_SKILL = /\b(?:bachelor|master|degree|ph\.?\s?d|diploma|graduate|years?|yrs)\b/i;
/** A category, not a skill: "backend technologies", "APIs", "modern frameworks" (toreview §110.5). */
const CATEGORY_NOUN = /^(?:technologies|technology|tools|frameworks|languages|skills|concepts|principles|practices|methodologies|platforms|systems|apis?|stacks?|solutions)$/i;
/** Only generic lowercase words before it ("backend", "modern web"); "REST APIs" names one. */
function isCategory(text: string): boolean {
  const words = text.trim().split(/\s+/);
  const noun = words.pop() ?? '';
  return CATEGORY_NOUN.test(noun) && words.length <= 2 && words.every((w) => /^[\p{Ll}-]+$/u.test(w));
}
export const isSkillName = (text: string): boolean =>
  text.trim().split(/\s+/).length <= 6 && !NOT_A_SKILL.test(text) && (resolveSkill(TAXONOMY, text).known || !isCategory(text));

/** "Job title: Frontend Developer", "Position – Data Analyst": a title the text labels as one. */
const TITLE_LINE = /^\s*(?:job\s*title|position|role|designation|job\s*role|opening)\s*[:\-–—]\s*(.{3,120}?)\s*$/im;

/**
 * The title as the text says it: the model's when the text contains it (letter case and dashes
 * aside), else a line the text labels as the title. Never a guess (G13): with neither, it is
 * missing and the page asks for it.
 */
const looseKey = (text: string) => ` ${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;

export function titleOf(raw: string, proposed: string | null): string | null {
  if (proposed && looseKey(proposed).trim() && looseKey(raw).includes(looseKey(proposed))) return proposed.trim();
  return TITLE_LINE.exec(raw)?.[1]?.trim() ?? null;
}

/**
 * "JavaScript and TypeScript" is two skills. Split only when every part is a skill the taxonomy
 * knows, so "Research and development" or "Sales & marketing" stays one item.
 */
export function splitSkills(text: string): string[] {
  const parts = text.split(/\s*(?:,|\band\b|&|\bplus\b)\s*/i).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return [text];
  return parts.every((p) => resolveSkill(TAXONOMY, p).known) ? parts : [text];
}

/** A skill name as the taxonomy reads it: split where it names several, dropped if not a skill. */
const skillNames = (name: string): string[] => (isSkillName(name) ? splitSkills(name.trim()) : []);

const COMPANY_SUFFIX = /\b(?:inc|ltd|llc|llp|plc|pvt|private|limited|gmbh|ag|corp|corporation|co|company)\b\.?/gi;
const companyKey = (text: string) => normalise(text.replace(COMPANY_SUFFIX, ' ')).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * The hiring company's own name is not a skill (toreview §159, §206.2): "Amazon" in an Amazon
 * posting was read as a required skill. A product that carries the company's name ("Google
 * Workspace") is a different phrase and stays, as does a name the taxonomy knows as a skill.
 */
export function skillNamesFor(company: string | null | undefined): (name: string) => string[] {
  const own = company ? companyKey(company) : '';
  if (!own) return skillNames;
  return (name) => (companyKey(name) === own && !resolveSkill(TAXONOMY, name).known ? [] : skillNames(name));
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Keeps only what the text says (toreview §153): the structure is built from the quotes found in
 * it, and the flat lists every consumer reads are derived from that structure.
 */
export function verify(raw: string, extraction: JdExtraction, options: { closesAt?: string; today?: string; closedNote?: string } = {}): VerifiedJd {
  const page = pageVerdict(raw, extraction.page);
  const closedNote = options.closedNote ?? (page?.kind === 'closed' ? page.note : undefined);
  const structured = structureJd(raw, extraction, { skillNames: skillNamesFor(extraction.company?.text), today: options.today ?? today(), ...(options.closesAt ? { closesAt: options.closesAt } : {}), ...(closedNote ? { closedNote } : {}) });
  const parsed = jdStructuredSchema.safeParse(structured);
  if (!parsed.success) throw new Error(`the structured reading did not validate: ${parsed.error.issues[0]?.message ?? 'unknown'}`);
  const legacy = legacyFields(structured);
  const kept = new Set([...structured.skills.map((k) => k.value), ...structured.responsibilities.map((r) => r.value)]);
  const droppedItems = [...extraction.skills.map((k) => k.name), ...extraction.responsibilities.map((r) => r.quote)].filter((name) => !kept.has(name) && !kept.has(name.trim()));
  return {
    ...legacy,
    title: titleOf(raw, legacy.title ?? extraction.title?.text ?? null),
    language: extraction.language,
    stats: { kept: structured.stats.kept, dropped: structured.stats.dropped, droppedItems: droppedItems.slice(0, 20) },
    structured,
    ...(page ? { page } : {}),
  };
}

export async function extractJd(args: {
  gateway: AiGateway;
  cache: KvCache;
  prompt: PromptVersion;
  text: string;
  context: CallContext;
  /** When the page it was read from says it closes, so a past date is flagged. */
  closesAt?: string;
  /** The page's own words that the posting has closed (toreview §206). */
  closedNote?: string;
}): Promise<{ jd: VerifiedJd; cached: boolean; meta?: CallMeta }> {
  const key = `jd:${args.prompt.id}:${contentHash(args.text)}`;
  const hit = await args.cache.get<JdExtraction>(key);
  const options = { ...(args.closesAt ? { closesAt: args.closesAt } : {}), ...(args.closedNote ? { closedNote: args.closedNote } : {}) };
  if (hit) return { jd: verify(args.text, hit, options), cached: true };
  const { data, meta } = await args.gateway.extract({
    stage: 'jd_extract',
    system: args.prompt.body.system.map((text) => ({ text })),
    input: { task: 'read this job posting into its canonical fields, quoting the text for every item' },
    untrusted: args.text,
    schema: jdExtractionSchema,
    name: 'job_description',
    description: 'The job posting in its canonical fields; every item quotes the text it came from.',
    context: args.context,
  });
  await args.cache.set(key, data, CACHE_DAYS * 24 * 3600);
  return { jd: verify(args.text, data, options), cached: false, meta };
}
