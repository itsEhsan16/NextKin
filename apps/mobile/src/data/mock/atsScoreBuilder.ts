import type { AtsCheckItem, AtsScore, AtsSection } from '@/data/models';
import { atsBandFor } from '@/data/models';
import type { DocumentContent } from '@/data/models/resumeContent';

/**
 * NextKin V2 spec §7.8 — how an ATS score is assembled, kept apart from the fixtures that seed
 * it so a repo can score a document it has just generated (plan Phase 9B) and re-score one the
 * section editor has just changed (plan Phase 9C). The checklist shape is RESUMES 04's; neither
 * generation nor re-scoring has an artboard, so those two carry spec citations instead.
 */

export const pass = (id: string, label: string): AtsCheckItem => ({ id, label, passed: true });

export const fix = (id: string, label: string): AtsCheckItem => ({
  id,
  label,
  passed: false,
  fixable: true,
});

/**
 * Checklist shape from RESUMES 04, parameterised so every scored doc gets a coherent panel.
 * The base resume fixture overrides this with the artboard's exact copy.
 */
export function buildSections(opts: {
  contentMiss?: string;
  present: [string, string];
  missing: string[];
  portfolioMiss?: boolean;
}): AtsSection[] {
  const { contentMiss, present, missing, portfolioMiss } = opts;
  return [
    {
      key: 'content',
      label: 'Content',
      items: [
        pass('quantified', 'Quantified achievements in 3+ bullets'),
        pass('verbs', 'Action verbs open every bullet'),
        pass('summary', 'Summary under 60 words'),
        pass('pronouns', 'No first-person pronouns'),
        ...(contentMiss ? [fix('content_gap', contentMiss)] : []),
      ],
    },
    {
      key: 'format',
      label: 'Format',
      items: [
        pass('column', 'Single column — parser safe'),
        pass('headings', 'Standard section headings'),
        pass('tables', 'No tables, text boxes or images'),
      ],
    },
    {
      key: 'keywords',
      label: 'Keywords',
      items: [
        pass('kw_1', `"${present[0]}" appears 3 times`),
        pass('kw_2', `"${present[1]}" appears twice`),
        ...missing.map((keyword, index) => fix(`kw_miss_${index}`, `Missing: "${keyword}"`)),
      ],
    },
    {
      key: 'best',
      label: 'Best practices',
      items: [
        pass('contact', 'Contact details complete'),
        pass('filename', 'File name follows convention'),
        pass('pages', 'Two pages or fewer'),
        ...(portfolioMiss ? [fix('portfolio', 'Add a portfolio link')] : []),
      ],
    },
  ];
}

export const summaryFor = (total: number, quickWins: number): string => {
  const band = atsBandFor(total);
  if (band === 'strong')
    return `Parsers will read this cleanly. ${quickWins} quick wins left before it is airtight.`;
  if (band === 'good') return 'Solid foundation — a few fixes will push this into the green.';
  return 'Parsers may stumble here. Start with the quick wins below.';
};

/**
 * Wraps a checklist in the band and the one-line verdict the score panel reads. Every fixable
 * item picks up its fix target here, so a seeded score and a generated one carry the same
 * `suggestion`/`section` for the same check id.
 */
export const buildAtsScore = (
  total: number,
  sections: AtsSection[],
  summary?: string,
): AtsScore => {
  const targeted = sections.map((section) => ({
    ...section,
    items: section.items.map(withFixTarget),
  }));
  const quickWins = targeted.flatMap((s) => s.items).filter((i) => !i.passed && i.fixable).length;
  return {
    total,
    band: atsBandFor(total),
    summary: summary ?? summaryFor(total, quickWins),
    sections: targeted,
  };
};

/** A keyword score starts here and only loses points, so the same inputs always agree. */
const KEYWORD_CEILING = 96;
/** Even a doc that matches nothing still passes the format and best-practice checks. */
const KEYWORD_FLOOR = 40;
/** One edit that flips one check is worth this much, up or down. */
const RESCORE_STEP = 4;

/** `buildSections` names two matched keywords; these stand in when the match found fewer. */
const KEYWORD_FALLBACK: readonly [string, string] = ['design', 'research'];

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** The keyword out of `Missing: "A/B testing"` — the label is the only place it is recorded. */
const quotedKeyword = (label: string): string | undefined => /"([^"]+)"/.exec(label)?.[1];

/** Point a fixable item at the content section its fix writes to (V2 §7.11 editor sections). */
function withFixTarget(item: AtsCheckItem): AtsCheckItem {
  if (item.passed || !item.fixable) return item;
  if (item.id.startsWith('kw_miss_')) {
    const keyword = quotedKeyword(item.label);
    if (!keyword) return item;
    return { ...item, suggestion: `Add "${keyword}" to your skills`, section: 'skills' };
  }
  if (item.id === 'content_gap')
    return { ...item, suggestion: 'Add numbers to your role bullets', section: 'experience' };
  if (item.id === 'portfolio')
    return { ...item, suggestion: 'Add a portfolio link to your resume', section: 'links' };
  return item;
}

/**
 * Scores a freshly generated document from the JD keyword match (V2 §7.8). `present` are keywords
 * the doc covers, `missing` ones it should add, `unsupported` ones the profile does not back —
 * those are shown as gaps and never offered as text to paste in.
 */
export function scoreFromKeywords(opts: {
  present: string[];
  missing: string[];
  unsupported?: string[];
  contentMiss?: string;
  portfolioMiss?: boolean;
}): AtsScore {
  const { present, missing, unsupported = [], contentMiss, portfolioMiss } = opts;
  const headline: [string, string] = [
    present[0] ?? KEYWORD_FALLBACK[0],
    present[1] ?? KEYWORD_FALLBACK[1],
  ];
  // Anything past the two the panel headlines still earns a line of its own.
  const extras = present
    .slice(2)
    .map((keyword, index) => pass(`kw_${index + 3}`, `"${keyword}" appears in your experience`));
  const gaps: AtsCheckItem[] = unsupported.map((keyword, index) => ({
    id: `kw_gap_${index}`,
    label: `"${keyword}" is not in your profile`,
    passed: false,
    fixable: false,
    supported: false,
  }));

  const penalty =
    4 * missing.length +
    6 * unsupported.length +
    3 * (contentMiss ? 1 : 0) +
    2 * (portfolioMiss ? 1 : 0);
  const total = clamp(KEYWORD_CEILING - penalty, KEYWORD_FLOOR, KEYWORD_CEILING);

  const sections = buildSections({ contentMiss, present: headline, missing, portfolioMiss }).map(
    (section) => {
      if (section.key !== 'keywords') return section;
      const misses = section.items.filter((item) => item.id.startsWith('kw_miss_'));
      // Only as many headline lines as there were real matches: the padding exists to satisfy
      // `buildSections`' pair, and a passing check the document never earned would make the
      // score unexplainable (V2 §7.8).
      const matched = section.items
        .filter((item) => !item.id.startsWith('kw_miss_'))
        .slice(0, present.length);
      return { ...section, items: [...matched, ...extras, ...misses, ...gaps] };
    },
  );

  return buildAtsScore(total, sections);
}

/** What an edit can change; every other check keeps the value it was scored with. */
type EditSignals = { haystack: string; quantified: boolean; hasLinks: boolean };

function nextPassed(item: AtsCheckItem, signals: EditSignals): boolean | undefined {
  if (item.id.startsWith('kw_miss_')) {
    const keyword = quotedKeyword(item.label);
    return keyword ? signals.haystack.includes(keyword.toLowerCase()) : undefined;
  }
  if (item.id === 'content_gap') return signals.quantified;
  if (item.id === 'portfolio') return signals.hasLinks;
  return undefined;
}

const passedCount = (sections: AtsSection[]): number =>
  sections.flatMap((section) => section.items).filter((item) => item.passed).length;

/**
 * Re-scores after a section edit (V2 §7.11). Only the checks an edit can flip are re-read — the
 * rest keep whatever scored them — so re-scoring unchanged content is a no-op and re-scoring
 * twice says the same as once. A cover letter has none of those sections.
 */
export function rescore(previous: AtsScore, content: DocumentContent): AtsScore {
  if (content.kind === 'cover_letter') return previous;

  const bullets = content.experience.flatMap((role) => role.bullets);
  const projectBullets = content.projects.flatMap((project) => project.bullets);
  const signals: EditSignals = {
    haystack: [content.summary, ...content.skills, ...bullets, ...projectBullets]
      .join('\n')
      .toLowerCase(),
    quantified: bullets.filter((bullet) => /\d/.test(bullet)).length >= 3,
    hasLinks: (content.links?.length ?? 0) > 0,
  };

  const sections = previous.sections.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      const passed = nextPassed(item, signals);
      return passed === undefined || passed === item.passed ? item : { ...item, passed };
    }),
  }));

  const delta = (passedCount(sections) - passedCount(previous.sections)) * RESCORE_STEP;
  const total = clamp(previous.total + delta, 0, 100);
  const quickWins = sections.flatMap((s) => s.items).filter((i) => !i.passed && i.fixable).length;
  return {
    total,
    band: atsBandFor(total),
    // res_base carries a verbatim RESUMES 04 line; a no-op edit must not paraphrase it away.
    summary: total === previous.total ? previous.summary : summaryFor(total, quickWins),
    sections,
  };
}
