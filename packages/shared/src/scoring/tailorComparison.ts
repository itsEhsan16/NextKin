import type { PartialDate } from '@nextkin/engines/dates';
import { phraseKey, wordCount } from '@nextkin/engines/text';

import {
  TAILOR_TARGET_PAGES,
  type JdDraft,
  type JobMatch,
  type TailorPlace,
  type TailorComparison,
  type TailorImprovement,
  type TailorKeyword,
  type TailorKeywordShown,
} from '../models';
import { backedPlaces, elsewhereFor } from '../tailor/elsewhere';
import { jdLists } from './adapters';
import type { DocumentScore, ScoringJd } from './report';
import { fixPlanOf } from './fixPlan';
import { quoteOf, says } from './jdText';
import { picksFor, type FitPlace } from './placeFit';
import { yearsRow, type YearsAsked } from './yearsAsked';

export { quoteOf } from './jdText';

/**
 * "Your resume vs this job" (TAILOR 02, W-TAILOR 01): the comparison's pure parts, shared by the
 * mock and the server (toreview §110). The score and the keywords come from the engine run that
 * scored the resume against the JD (C-10): a keyword is on the resume when the requirement ledger
 * finds it, by canonical skill, never by substring. Nothing here calls a model.
 */

/** A listing snippet says less about a job than a full description; the report says which. */
export const FULL_JD_WORDS = 80;

/** A JD as the scorer reads it: its lists, and whether it is a full description. */
export const scoringJdOf = (draft: JdDraft): ScoringJd => ({
  ...jdLists(draft),
  completeness: wordCount(draft.rawText) >= FULL_JD_WORDS ? 'full' : 'snippet',
});

/**
 * How the ledger saw it (D-14): used in a dated role is full credit; only listed, or shown for
 * fewer years than asked, is part credit. The comparison says which, so a tick is never worth
 * more on screen than in the score (toreview §110.6).
 */
const shownOf = (r: DocumentScore['report']['requirements'][number]): TailorKeywordShown | undefined =>
  r.status === 'met' ? 'experience' : r.status !== 'partial' ? undefined : r.evidence === 'listed' ? 'listed' : 'fewer_years';

const SHOWN_ORDER: Record<TailorKeywordShown, number> = { experience: 0, fewer_years: 1, listed: 2 };

/** How many keywords step 1 shows, as Jobright's "ATS job keywords (8/10)" (toreview §113). */
export const TOP_KEYWORDS = 10;

/** Compares two equal-length number tuples, first differing place first. */
const byTuple = (a: readonly number[], b: readonly number[]): number => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return (a[i] ?? 0) - (b[i] ?? 0);
  return 0;
};

/** Whole-word occurrences of a phrase in a text. */
const timesSaid = (text: string, phrase: string): number => {
  const hay = ` ${phraseKey(text)} `;
  const needle = ` ${phraseKey(phrase)} `;
  if (needle.trim() === '') return 0;
  let n = 0;
  for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + 1)) n += 1;
  return n;
};

/**
 * The job's most important keywords (toreview §113), by code from what the JD says: required
 * before preferred, then the ones the title names, then how often the text names them, then the
 * JD's own order. Soft skills are never among them.
 */
export function markTop(keywords: readonly TailorKeyword[], rawText = '', title = '', n = TOP_KEYWORDS): TailorKeyword[] {
  const ranked = keywords
    .map((k, i) => ({ k, i }))
    .filter(({ k }) => k.kind !== 'soft')
    .map(({ k, i }) => ({ label: k.label, i, rank: [k.source === 'required' ? 0 : 1, says(title, k.label) ? 0 : 1, -timesSaid(rawText, k.label), i] }))
    .sort((a, b) => byTuple(a.rank, b.rank));
  const top = new Set(ranked.slice(0, n).map((r) => r.label));
  return keywords.map((k) => (top.has(k.label) ? { ...k, top: true } : k));
}

/**
 * "Job match": of the job's top keywords (all of them when none is marked), how many the resume
 * shows anywhere, in its skills, summary, roles or projects (toreview §112, §113).
 */
export function jobMatchOf(keywords: readonly TailorKeyword[]): JobMatch | undefined {
  const skills = keywords.filter((k) => k.kind !== 'soft');
  const counted = skills.some((k) => k.top) ? skills.filter((k) => k.top) : skills;
  if (counted.length === 0) return undefined;
  const matched = counted.filter((k) => k.onResume).length;
  const total = counted.length;
  return {
    matched,
    total,
    percent: Math.round((matched / total) * 100),
    missing: counted.filter((k) => !k.onResume).map((k) => k.label),
    basis: `${matched} of this job’s ${total} most important keywords appear in your resume: in its skills, summary, roles or projects. Soft skills aren’t counted.`,
  };
}

/** The JD's skills, each marked on or off the resume and how, from the requirement ledger. */
export function keywordsFrom(result: DocumentScore | undefined, rawText?: string, title?: string): TailorKeyword[] {
  const out: TailorKeyword[] = (result?.report.requirements ?? [])
    .filter((r) => r.status !== 'eligibility')
    .map((r) => {
      const shown = shownOf(r);
      const quote = quoteOf(rawText, r.text);
      return {
        label: r.text,
        onResume: r.status === 'met' || r.status === 'partial',
        ...(shown ? { shown } : {}),
        source: r.importance === 'required' ? 'required' : 'description',
        ...(quote ? { quote } : {}),
      };
    });
  // What is on the resume first (shown in experience before only listed), then the gaps — the
  // order the boards read them (607:2).
  const on = out.filter((k) => k.onResume).sort((a, b) => SHOWN_ORDER[a.shown ?? 'experience'] - SHOWN_ORDER[b.shown ?? 'experience']);
  return markTop([...on, ...out.filter((k) => !k.onResume)], rawText, title);
}

/** What a comparison knows of the layout: measured in the uploaded file, or NextKin's template. */
export type LayoutSource =
  | { from: 'file'; ok: boolean; found: readonly string[] }
  | { from: 'template' };

const joinAnd = (items: readonly string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** The Layout row: what was checked, and on what, never a pass nothing measured. */
function layoutRow(layout: LayoutSource | undefined): TailorImprovement {
  if (layout?.from === 'file') {
    return {
      key: 'layout',
      label: 'Layout',
      detail: layout.ok
        ? 'Checked in your file: one column, no tables or pictures, the usual section headings, contact in the text.'
        : `Your file has ${joinAnd(layout.found)}. The tailored resume downloads in a one-column ATS layout.`,
      ok: layout.ok,
    };
  }
  return {
    key: 'layout',
    label: 'Layout',
    detail: 'Downloads in NextKin’s one-column template, which every download reads back to check.',
    ok: true,
  };
}

export type TailorTargetText = { title: string; company?: string };


/** The "what to improve" rows, read off the resume against the job it is aimed at. */
export function improvementsFor(args: {
  headline: string;
  summary: string;
  /** What the resume was written for, when it says: "Written for Product Designer roles". */
  writtenFor?: string;
  pages?: number;
  pagesEstimated?: boolean;
  target: TailorTargetText;
  /** Measured in the uploaded file, or NextKin's template (the mock's documents). */
  layout?: LayoutSource;
  /** The JD's years and the resume's dated months, when the JD names years (toreview §113). */
  years?: { asked: YearsAsked | null; shownMonths: number };
  /** The job's top keywords (toreview §113): a summary naming three of them is aimed at it. */
  topKeywords?: readonly string[];
}): TailorImprovement[] {
  const { headline, summary, writtenFor, pages, pagesEstimated, target } = args;
  const headlineOk = says(headline, target.title);
  const top = args.topKeywords ?? [];
  const named = top.filter((k) => says(summary, k));
  const unnamed = top.filter((k) => !says(summary, k)).slice(0, 3);
  const summaryOk =
    (target.company ? says(summary, target.company) : false) || says(summary, target.title) || named.length >= 3;
  const lengthOk = pages == null || pages <= TAILOR_TARGET_PAGES;
  const about = pagesEstimated ? 'About ' : '';
  const pageWord = (n: number) => (n === 1 ? 'page' : 'pages');
  return [
    {
      key: 'headline',
      label: 'Headline',
      detail: headlineOk
        ? `Already says ${target.title}.`
        : `Says ${headline}. This job is ${target.title}.`,
      ok: headlineOk,
    },
    ...(args.years?.asked ? [yearsRow(args.years.asked, args.years.shownMonths)] : []),
    {
      key: 'summary',
      label: 'Summary',
      // A text check: whether the summary names this job's title or its company.
      detail: summaryOk
        ? named.length >= 3 ? `Names ${named.length} of this job’s top keywords.` : 'Names this role or the company.'
        : summary.trim()
          ? writtenFor
            ? `Written for ${writtenFor} roles; it names neither this title nor the company.`
            : unnamed.length
              ? `Doesn’t show your fit for this job: it names neither the title nor ${joinAnd(unnamed)}.`
              : 'Names neither this job’s title nor the company.'
          : 'There is no summary yet. One aimed at this role helps.',
      ok: summaryOk,
    },
    {
      key: 'length',
      label: 'Length',
      detail: lengthOk
        ? `${about}${pages ?? 1} ${pageWord(pages ?? 1)}. Easy to skim.`
        : `${about}${pages} ${pageWord(pages ?? 2)}. Recruiters skim one or two.`,
      ok: lengthOk,
    },
    layoutRow(args.layout),
  ];
}

/** The comparison as the tailor flow reads it; no total without a JD that says enough (D-15). */
export function comparisonOf(args: {
  resumeId: string;
  jdId: string;
  jobId?: string;
  result: DocumentScore | undefined;
  improvements: TailorImprovement[];
  pageCount?: number;
  pagesEstimated?: boolean;
  rawText?: string;
  /** The JD's title, for ranking its keywords. */
  title?: string;
  /** The JD's soft skills (toreview §112), offered in their own group. */
  softSkills?: readonly string[];
  /** All of the resume's text, for whether it says a soft skill. */
  resumeText?: string;
  places?: TailorPlace[];
  /** The places' own lines, for where each missing keyword fits (toreview §163). */
  fitPlaces?: readonly FitPlace[];
  asOf?: PartialDate;
  /** The candidate's other records, to say which missing keywords they already have (§206.3). */
  elsewhere?: Omit<Parameters<typeof elsewhereFor>[0], 'keywords'>;
}): TailorComparison {
  const total = args.result?.score?.total;
  const soft: TailorKeyword[] = (args.softSkills ?? []).map((label) => {
    const quote = quoteOf(args.rawText, label);
    return { label, onResume: says(args.resumeText ?? '', label), source: 'description', kind: 'soft', ...(quote ? { quote } : {}) };
  });
  const read = [...keywordsFrom(args.result, args.rawText, args.title), ...soft];
  const found = args.elsewhere ? elsewhereFor({ ...args.elsewhere, keywords: read }) : {};
  const keywords = read.map((k) => (found[k.label] ? { ...k, elsewhere: found[k.label]! } : k));
  const backed = backedPlaces(found);
  const jobMatch = jobMatchOf(keywords);
  const plan = fixPlanOf({ result: args.result, ...(args.rawText ? { rawText: args.rawText } : {}), improvements: args.improvements });
  const picks = args.fitPlaces ? picksFor(keywords, args.fitPlaces, args.asOf) : {};
  return {
    resumeId: args.resumeId,
    ...(args.jobId ? { jobId: args.jobId } : {}),
    jdId: args.jdId,
    score: total ?? 0,
    scored: total !== undefined,
    keywords,
    ...(jobMatch ? { jobMatch } : {}),
    ...(args.places?.length ? { places: args.places } : {}),
    ...(Object.keys(picks).length ? { picks } : {}),
    ...(Object.keys(backed).length ? { backed } : {}),
    ...(plan ? { plan } : {}),
    improvements: args.improvements,
    ...(args.pageCount != null ? { pageCount: args.pageCount } : {}),
    ...(args.pagesEstimated ? { pagesEstimated: true } : {}),
  };
}
