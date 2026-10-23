import { arrangementIn, JD_SECTION_KINDS, salaryIn, type JdReading, type JdSection } from '@nextkin/shared/jobs/jdSections';
import { z } from 'zod';

import type { AiGateway, CallContext } from '../../ai/gateway';
import type { KvCache } from '../../cache/kv';
import type { PromptVersion } from '../../services/prompts';
import { CACHE_DAYS, contentHash, normalise } from './extractJd';

/**
 * The JD in its sections, by a model, when the rules can't read it (toreview §129: "use AI to
 * refine, if the mechanism fails"). The rules come first (`jobs/jdSections.ts`); only a text with
 * too few headings to read by rule comes here. The model only **groups**: every line it returns
 * must be found verbatim in the text, and every heading too, or it is dropped (G13, G14). Pay and
 * the work arrangement are read by code, never by the model. Cached like the extraction.
 */

export const JD_SECTIONS_TEMPLATE = 'jd.sections';

export const jdSectionsSchema = z.object({
  sections: z
    .array(
      z.object({
        kind: z.enum(JD_SECTION_KINDS as [JdSection['kind'], ...JdSection['kind'][]]),
        heading: z.string().trim().max(120).nullable(),
        lines: z.array(z.string().trim().min(1).max(600)).max(40),
      }),
    )
    .max(20),
});
export type JdSectionsOutput = z.infer<typeof jdSectionsSchema>;

const BULLET = /^\s*(?:[-*•▪·●◦‣–]|\d{1,2}[.)])\s+/;

/** Keeps only what the text says; a line is a bullet when the text's own line was one. */
export function verifySections(raw: string, output: JdSectionsOutput): { reading: JdReading; dropped: number } {
  const haystack = normalise(raw);
  const rawLines = raw.split(/\r?\n/);
  const seen = new Set<string>();
  let dropped = 0;
  const sections: JdSection[] = [];
  for (const s of output.sections) {
    const section: JdSection = { kind: s.kind, paragraphs: [], items: [] };
    if (s.heading && haystack.includes(normalise(s.heading))) section.heading = s.heading;
    for (const line of s.lines) {
      const key = normalise(line.replace(BULLET, ''));
      if (!key || !haystack.includes(key) || seen.has(key)) {
        dropped += 1;
        continue;
      }
      seen.add(key);
      const own = rawLines.find((l) => normalise(l).includes(key));
      (own && BULLET.test(own) ? section.items : section.paragraphs).push(line.replace(BULLET, '').trim());
    }
    if (section.paragraphs.length || section.items.length) sections.push(section);
  }
  const classified = sections.filter((s) => s.kind !== 'overview' && s.kind !== 'other').length;
  const salary = salaryIn(raw);
  const workArrangement = arrangementIn(raw);
  return {
    reading: { sections, ...(salary ? { salary } : {}), ...(workArrangement ? { workArrangement } : {}), confidence: classified >= 2 ? 'strong' : 'weak', by: 'model' },
    dropped,
  };
}

export async function structureJd(args: {
  gateway: AiGateway;
  cache: KvCache;
  prompt: PromptVersion;
  text: string;
  context: CallContext;
}): Promise<{ reading: JdReading; dropped: number; cached: boolean }> {
  const key = `jdsec:${args.prompt.id}:${contentHash(args.text)}`;
  const hit = await args.cache.get<JdSectionsOutput>(key);
  if (hit) return { ...verifySections(args.text, hit), cached: true };
  const { data } = await args.gateway.extract({
    stage: 'jd_extract',
    system: args.prompt.body.system.map((text) => ({ text })),
    input: { task: 'group this job description’s own lines into its sections, copying every line exactly' },
    untrusted: args.text,
    schema: jdSectionsSchema,
    name: 'job_description_sections',
    description: 'The job description’s lines grouped into its sections, each line copied exactly from the text.',
    context: args.context,
  });
  await args.cache.set(key, data, CACHE_DAYS * 24 * 3600);
  return { ...verifySections(args.text, data), cached: false };
}
