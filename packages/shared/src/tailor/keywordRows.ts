import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { phraseKey } from '@nextkin/engines/text';
import { resolveSkill, skillById, type SkillCategory } from '@nextkin/engines/normalizer';

import type { KeywordElsewhere, TailorComparison, TailorKeyword } from '../models/tailor';

/**
 * The keyword table of the tailor flow's "Choose keywords" step (owner's mockup, 2026-11-11):
 * every keyword the job asks for that the resume lacks, each with its tab, its category and what
 * it is worth. Every field is read off the comparison; nothing here is invented (G13, G17).
 */

/** Missing: the job requires it. Optional: the job prefers it, or it is a soft skill. */
export type KeywordTab = 'missing' | 'optional';

/** The rail's groups, in the order it lists them. */
export const KEYWORD_BUCKETS = ['technical', 'soft', 'tools', 'domains', 'other'] as const;
export type KeywordBucket = (typeof KEYWORD_BUCKETS)[number];

export const KEYWORD_BUCKET_LABEL: Record<KeywordBucket, string> = {
  technical: 'Technical skills',
  soft: 'Soft skills',
  tools: 'Tools & platforms',
  domains: 'Domains & concepts',
  other: 'Other',
};

/** Which rail group each taxonomy category falls in. */
const BUCKET_OF: Record<SkillCategory, KeywordBucket> = {
  language: 'technical',
  framework: 'technical',
  library: 'technical',
  database: 'technical',
  tool: 'tools',
  cloud: 'tools',
  devops: 'tools',
  methodology: 'domains',
  practice: 'domains',
  design: 'domains',
  domain: 'domains',
};

/** The row's own tag: the taxonomy's category in words. */
const CATEGORY_LABEL: Record<SkillCategory, string> = {
  language: 'Language',
  framework: 'Framework',
  library: 'Library',
  database: 'Database',
  tool: 'Tool',
  cloud: 'Cloud',
  devops: 'DevOps',
  methodology: 'Methodology',
  practice: 'Practice',
  design: 'Design',
  domain: 'Domain',
};

export type KeywordRow = {
  label: string;
  tab: KeywordTab;
  bucket: KeywordBucket;
  /** The tag on the row: "Framework", "Soft skill"; null when the taxonomy doesn't know it. */
  tag: string | null;
  /** Points out of 10 it adds once placed in a role (the plan's own price); null when unpriced. */
  worth: number | null;
  /** Why it is worth that, from the plan step. */
  basis?: string;
  /** One of the job's ~10 most important keywords. */
  top: boolean;
  /** The job's own line asking for it. */
  quote?: string;
  /** Where the candidate's own records already show it (toreview §206.3). */
  elsewhere?: KeywordElsewhere;
};

function categoryOf(k: TailorKeyword): { bucket: KeywordBucket; tag: string | null } {
  if (k.kind === 'soft') return { bucket: 'soft', tag: 'Soft skill' };
  const ref = resolveSkill(TAXONOMY, k.label);
  const category = ref.known ? skillById(TAXONOMY, ref.id)?.category : undefined;
  return category
    ? { bucket: BUCKET_OF[category], tag: CATEGORY_LABEL[category] }
    : { bucket: 'other', tag: null };
}

/**
 * The missing keywords as rows: top ones first, then by worth, then as the job lists them (a
 * stable sort keeps the comparison's order among equals).
 */
export function keywordRowsOf(comparison: TailorComparison): KeywordRow[] {
  const steps = comparison.plan?.steps ?? [];
  const priced = new Map<string, { worth: number | null; basis: string }>();
  for (const s of steps) {
    if (s.kind === 'keyword' && s.keyword && !priced.has(s.keyword))
      priced.set(s.keyword, { worth: s.worth, basis: s.basis });
  }
  const rows = comparison.keywords
    .filter((k) => !k.onResume)
    .map((k): KeywordRow => {
      const price = priced.get(k.label);
      return {
        label: k.label,
        tab: k.kind === 'soft' || k.source === 'description' ? 'optional' : 'missing',
        ...categoryOf(k),
        worth: price?.worth ?? null,
        ...(price ? { basis: price.basis } : {}),
        top: k.top === true,
        ...(k.quote ? { quote: k.quote } : {}),
        ...(k.elsewhere ? { elsewhere: k.elsewhere } : {}),
      };
    });
  return sortRows(rows, 'default');
}

export type KeywordSort = 'default' | 'worth-desc' | 'worth-asc';

const worthOf = (r: KeywordRow, missing: number) => r.worth ?? missing;

/** Default: top first, then the most worth. By worth: unpriced rows always last. */
export function sortRows(rows: readonly KeywordRow[], sort: KeywordSort): KeywordRow[] {
  const out = [...rows];
  if (sort === 'default')
    // What the candidate already has leads: it is the surest gain on the page (toreview §206.3).
    return out.sort((a, b) => Number(Boolean(b.elsewhere)) - Number(Boolean(a.elsewhere)) || Number(b.top) - Number(a.top) || worthOf(b, -1) - worthOf(a, -1));
  const dir = sort === 'worth-desc' ? 1 : -1;
  return out.sort((a, b) => {
    if (a.worth === null || b.worth === null) return Number(a.worth === null) - Number(b.worth === null);
    return dir * (b.worth - a.worth);
  });
}

/** The rows a tab, a rail group and a search leave showing. */
export function filterRows(
  rows: readonly KeywordRow[],
  { tab, bucket, query }: { tab: KeywordTab; bucket?: KeywordBucket; query?: string },
): KeywordRow[] {
  const q = phraseKey(query ?? '');
  return rows.filter(
    (r) =>
      r.tab === tab &&
      (bucket === undefined || r.bucket === bucket) &&
      (q === '' || phraseKey(r.label).includes(q) || (r.tag !== null && phraseKey(r.tag).includes(q))),
  );
}

/** How many rows each rail group holds within a tab, groups with none left out. */
export function bucketCounts(rows: readonly KeywordRow[], tab: KeywordTab): { bucket: KeywordBucket; count: number }[] {
  return KEYWORD_BUCKETS.map((bucket) => ({ bucket, count: rows.filter((r) => r.tab === tab && r.bucket === bucket).length })).filter((b) => b.count > 0);
}

/** The impact bar: how many of five segments a worth fills, against the most any row is worth. */
export function impactSegments(worth: number | null, max: number): number {
  if (worth === null || worth <= 0 || max <= 0) return 0;
  return Math.min(5, Math.max(1, Math.ceil((worth / max) * 5)));
}
