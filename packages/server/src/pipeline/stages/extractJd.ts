import { createHash } from 'node:crypto';

import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { resolveSkill } from '@nextkin/engines/normalizer';
import { phraseKey } from '@nextkin/engines/text';
import type { JdReading } from '@nextkin/shared/jobs/jdSections';
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

const item = z.object({ text: z.string().trim().min(1).max(120), quote: z.string().trim().min(1).max(400) });

export const jdExtractionSchema = z.object({
  title: z.string().trim().max(200).nullable(),
  company: z.string().trim().max(200).nullable(),
  location: z.string().trim().max(200).nullable(),
  experienceLevel: z.enum(['entry', 'mid', 'senior', 'lead']).nullable(),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'internship', 'freelance']).nullable(),
  domain: z.string().trim().max(120).nullable(),
  language: z.enum(['en', 'de', 'other']),
  requiredSkills: z.array(item).max(40),
  preferredSkills: z.array(item).max(40),
  tools: z.array(item).max(40),
  responsibilities: z.array(item).max(40),
  /** Traits and soft skills ("communication", "teamwork"): shown, never scored (toreview §112). */
  softSkills: z.array(item).max(20),
});
export type JdExtraction = z.infer<typeof jdExtractionSchema>;

/** What generation and the review screen read: verified lists, and what was dropped. */
export interface VerifiedJd {
  title: string | null;
  company: string | null;
  location: string | null;
  experienceLevel: JdExtraction['experienceLevel'];
  employmentType: JdExtraction['employmentType'];
  domain: string | null;
  language: JdExtraction['language'];
  requiredSkills: string[];
  preferredSkills: string[];
  tools: string[];
  responsibilities: string[];
  softSkills?: string[];
  stats: { kept: number; dropped: number; droppedItems: string[] };
  /** The JD's sections as a model grouped them, when the rules could not (toreview §129). */
  reading?: JdReading;
  /** When the page it was read from says it closes (toreview §144.3). */
  closesAt?: string;
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

/** Keeps only what the text says, and only skills in the skill lists. */
export function verify(raw: string, extraction: JdExtraction): VerifiedJd {
  const haystack = normalise(raw);
  const said = (value: string | null) => (value && haystack.includes(normalise(value)) ? value : null);
  const droppedItems: string[] = [];
  let kept = 0;
  /** `skill`: a named skill, split; `quote`: the JD's own line; `name`: the item as named. */
  const keep = (items: JdExtraction['requiredSkills'], mode: 'skill' | 'quote' | 'name' = 'skill') => {
    const skills = mode === 'skill';
    const out: string[] = [];
    for (const { text, quote } of items) {
      const quoted = haystack.includes(normalise(quote));
      const own = ` ${phraseKey(quote)} `.includes(` ${phraseKey(text)} `);
      if (quoted && own && (!skills || isSkillName(text))) {
        // A responsibility is shown as the JD wrote it: its verified quote, which the model may not
        // shorten; a skill is the name, split where it names several.
        for (const name of skills ? splitSkills(text) : mode === 'quote' ? [quote] : [text]) if (!out.some((t) => phraseKey(t) === phraseKey(name))) out.push(name);
        kept += 1;
      } else droppedItems.push(text);
    }
    return out;
  };
  return {
    title: titleOf(raw, extraction.title),
    company: said(extraction.company),
    location: said(extraction.location),
    experienceLevel: extraction.experienceLevel,
    employmentType: extraction.employmentType,
    domain: extraction.domain,
    language: extraction.language,
    requiredSkills: keep(extraction.requiredSkills),
    preferredSkills: keep(extraction.preferredSkills),
    tools: keep(extraction.tools),
    responsibilities: keep(extraction.responsibilities, 'quote'),
    softSkills: keep(extraction.softSkills ?? [], 'name'),
    stats: { kept, dropped: droppedItems.length, droppedItems: droppedItems.slice(0, 20) },
  };
}

export async function extractJd(args: {
  gateway: AiGateway;
  cache: KvCache;
  prompt: PromptVersion;
  text: string;
  context: CallContext;
}): Promise<{ jd: VerifiedJd; cached: boolean; meta?: CallMeta }> {
  const key = `jd:${args.prompt.id}:${contentHash(args.text)}`;
  const hit = await args.cache.get<JdExtraction>(key);
  if (hit) return { jd: verify(args.text, hit), cached: true };
  const { data, meta } = await args.gateway.extract({
    stage: 'jd_extract',
    system: args.prompt.body.system.map((text) => ({ text })),
    input: { task: 'read this job description into typed fields, quoting the text for every item' },
    untrusted: args.text,
    schema: jdExtractionSchema,
    name: 'job_description',
    description: 'The job description as typed fields; every item quotes the text it came from.',
    context: args.context,
  });
  await args.cache.set(key, data, CACHE_DAYS * 24 * 3600);
  return { jd: verify(args.text, data), cached: false, meta };
}
