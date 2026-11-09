import type { GenerationStatus } from './generation';
import type { LineRestore } from '../scoring/lineRestore';
import type { ResumeSectionKey } from './resumeContent';
import type { PlausibilityNote } from '../scoring/plausibility';

/** NextKin V2 spec §10 — Resume aggregate (candidate app). */

/** The Resumes library holds both document kinds (Figma RESUMES 01 type filter). */
export type ResumeDocType = 'resume' | 'cover_letter';

/**
 * What kind of document the web library says this is (Figma 286:1675's type tag): written for a
 * role or a job, a general-purpose one, or started from a template. Mobile's documents leave it
 * unset; they say "Base" and name their target instead.
 */
export type ResumeVariant = 'tailored' | 'default' | 'template';

/** The tint a document's tile wears in the web library (Figma 304:3127, 3151, 3175, 3199, 3223). */
export type ResumeAccent = 'indigo' | 'pink' | 'blue' | 'green' | 'amber';

export type Resume = {
  id: string;
  title: string;
  docType: ResumeDocType;
  /** The one resume the tailored copies derive from (RESUMES pill "Base", 1:1422). */
  isBase?: boolean;
  /** The linked JD changed since this doc was generated (amber pill, Figma 1:1440). */
  updateAvailable?: boolean;
  /** Print length; the list row quotes it for the base resume (Figma 1:1632). */
  pageCount?: number;
  targetCompany?: string;
  targetRole?: string;
  thumbnailUrl?: string;
  /** ISO-8601 */
  createdAt: string;
  /** ISO-8601 */
  updatedAt: string;
  versionCount: number;
  currentVersionId: string;
  /** 0–100; absent until scoring completes. */
  atsScore?: number;
  /** 0–1 — how complete the resume content is (sections filled, review gates passed). */
  completeness?: number;
  /** Outcome of the V2 §7.7 / §7.8 validation passes, shown as checks on the dashboard. */
  validation?: ResumeValidation;
  status: GenerationStatus;
  linkedJobId?: string;
  tags: string[];
  /**
   * Zero Resume Mode output the user has not confirmed yet; blocks download (V2 §7.9).
   * duplicate() copies it deliberately — a copy of an unreviewed draft is still unreviewed.
   */
  needsReview?: boolean;
  /** The web library's type tag. */
  variant?: ResumeVariant;
  /** The line under the title in the web library: "Tailored for Product Design roles". */
  description?: string;
  /** The web library's tile tint; a document without one takes the brand tint. */
  accent?: ResumeAccent;
  /** Still being written by hand. V2 §7.11 lists "draft" beside the generation states. */
  draft?: boolean;
  /** Set aside but kept, history and all: the web library's Archived tag and pill. */
  archived?: boolean;
  /** The current version was confirmed accurate before export (V2 §15 risk 2). */
  accuracyConfirmed?: boolean;
};

export type ResumeValidation = {
  timelineValid: boolean;
  atsOptimized: boolean;
  jdMatched: boolean;
};

export type ResumeVersion = {
  id: string;
  resumeId: string;
  /** 1-based, monotonically increasing per resume. */
  version: number;
  /** ISO-8601 */
  createdAt: string;
  changeNote?: string;
  /** Who made it (V2 §7.11 records the actor): a hand edit, a generation, a restore. */
  actor?: 'user' | 'generation' | 'restore' | 'zero_review' | 'upload';
  /** Older than the plan shows (Free sees the last 3): kept, not deleted, and restorable on Pro. */
  locked?: boolean;
};

export type ReadBackCount = { found: number; total: number };

/** What read back from a downloaded file, counted from the file itself (toreview §146.6). */
export type ExportReceipt = { sections: ReadBackCount; bullets: ReadBackCount };

/** Everything read back. A shorter count is said plainly, and the file is still theirs to use. */
export const receiptClean = ({ sections, bullets }: ExportReceipt): boolean =>
  sections.found === sections.total && bullets.found === bullets.total;

/** "We read it back: 5 of 5 sections, 23 of 23 bullets." */
export function receiptSentence(receipt: ExportReceipt): string {
  const { sections, bullets } = receipt;
  if (!receiptClean(receipt)) {
    const [left, total] = bullets.found < bullets.total ? [bullets.found, bullets.total] : [sections.found, sections.total];
    const noun = bullets.found < bullets.total ? 'bullets' : 'sections';
    return `Only ${left} of ${total} ${noun} read back. Open the file and check it.`;
  }
  const counts = [`${sections.found} of ${sections.total} sections`];
  if (bullets.total > 0) counts.push(`${bullets.found} of ${bullets.total} bullets`);
  return `We read it back: ${counts.join(', ')}.`;
}

/** One change a version made, and why (toreview §146.5). */
export type VersionChange = {
  kind: 'added' | 'removed' | 'reworded';
  /** "Summary", "Skills", "Designer at Acme". */
  where: string;
  /** The line now, or the line that went. */
  text: string;
  /** A rewording's old line. */
  before?: string;
  why: string;
  /** A line the tailor's review took out (§202): where it sat, so Restore can put it back. */
  restore?: LineRestore;
};

export type AtsBand = 'strong' | 'good' | 'fair' | 'weak';

/** Band pill copy on the score panel (Figma 1:2119). */
export const ATS_BAND_LABEL: Record<AtsBand, string> = {
  strong: 'Strong',
  good: 'Good',
  fair: 'Fair',
  weak: 'Weak',
};

/**
 * V2 §7.8 calls this the NextKin Score and requires a rubric link from every score display. The
 * built screens say "ATS score" (Figma RESUMES 04's own label), so the built vocabulary stands and
 * this constant is the single place to change it if design decides otherwise. Never claim
 * compatibility with a named third-party ATS.
 */
export const SCORE_LABEL = 'ATS score';
/** The ring's label. */
export const SCORE_LABEL_CAPS = 'ATS SCORE';

/** One weighted component of the published rubric (V2 §7.8). */
export type ScoreRubricComponent = { key: string; label: string; weight: number; detail: string };

/**
 * The five components of V2 §7.8's rubric, in the spec's order and at the spec's initial weights
 * (they sum to 100). §7.8 requires the rubric to be published in-product and reachable from every
 * score display, so this is the copy `ScoreRubricScreen` renders — the weights are the product's
 * public claim about the number, not a UI detail.
 */
export const SCORE_RUBRIC: readonly ScoreRubricComponent[] = [
  {
    key: 'keywords',
    label: 'Keyword match',
    weight: 40,
    detail:
      'We compare the skills and tools the job description asks for against what your resume actually says, counting the required ones heavier than the preferred ones. Closing a required-skill gap moves this component more than anything else on the page. A keyword your profile does not back is shown as a gap, never written in for you.',
  },
  {
    key: 'timeline',
    label: 'Timeline validity',
    weight: 20,
    detail:
      'Every technology on the document is checked against the dates of the role it sits under. Claims that hold up raise this component; one unresolved conflict — a tool cited years before it existed — takes it to zero on its own.',
  },
  {
    key: 'sections',
    label: 'Section completeness',
    weight: 15,
    detail:
      'Summary, skills, dated experience, education and contact details each need to be there and to say something. Filling a thin section, or adding the dates a role is missing, moves this.',
  },
  {
    key: 'formatting',
    label: 'Formatting and parseability',
    weight: 15,
    detail:
      'This looks at the shape of the document rather than the words: one column, standard headings, real text instead of tables or images, contact details in the body, and dates written the same way throughout. Switching to a parse-safe template usually settles it in one step.',
  },
  {
    key: 'achievements',
    label: 'Quantified achievements',
    weight: 10,
    detail:
      'We look for measurable outcomes in your experience bullets — numbers, percentages, scale, time saved. Turning "improved onboarding" into "cut onboarding from five days to two" moves this component.',
  },
];

/**
 * V2 §7.8's honesty note, in the product's voice. It is binding on every surface that shows a
 * score, and it is the spine of the rubric screen rather than a footnote on it: the number is a
 * measurement against our own rubric and nothing more. Never soften it into a promise.
 */
export const SCORE_HONESTY_NOTE = `There is no universal ${SCORE_LABEL}. This one measures your document against NextKin's own published rubric — the five components below, and nothing else. It is not a prediction of how any particular employer's software will read, rank or filter your application: every system parses differently, and no tool can honestly promise a result in one. Use the number to make the document stronger, not to guess at an outcome.`;

/**
 * Where a fixable check lands. Every editor section qualifies, plus `'links'` — that one is not an
 * editor section but `ResumeContent.links`, which is where the "Add a portfolio link" fix writes.
 */
export type AtsFixTarget = ResumeSectionKey | 'links';

/** One checklist line on the score panel (Figma 1:2127–1:2178). */
export type AtsCheckItem = {
  id: string;
  label: string;
  passed: boolean;
  /** An unmet item the product can act on — it earns the "Fix" pill and counts as a quick win. */
  fixable?: boolean;
  /** What to do about it, shown on the fix screen: 'Add "A/B testing" to your skills'. */
  suggestion?: string;
  /** Which editor section the fix lands in — or `'links'` for the portfolio-link fix. */
  section?: AtsFixTarget;
  /**
   * false = a JD keyword the profile does not back. Shown as a gap and never inserted — V2 §7.8
   * forbids presenting missing keywords as text to paste in.
   */
  supported?: boolean;
  /** The JD skill this line is about, as the JD words it (C-10): no more reading it out of `label`. */
  keyword?: string;
  /** The typed fix in `AtsScore.report.fixes` this line applies, when it has one. */
  fixId?: string;
  /** What the fix rests on, in words: `AtsFix.basis`. */
  basis?: string;
};

/** "Content", "Format", "Keywords", "Best practices" (Figma RESUMES 04). */
export type AtsSection = {
  key: string;
  label: string;
  items: AtsCheckItem[];
};

export type AtsScore = {
  /** 0–100 */
  total: number;
  band: AtsBand;
  /** One-line verdict under the band pill, led by the job match (G17), never picked from the total. */
  summary: string;
  sections: AtsSection[];
  /**
   * What the number rests on (C-10): written by `packages/engines` and mapped in
   * `scoring/report.ts`, so the mock and the server say the same thing for the same input.
   */
  report?: AtsReport;
};

/** The rubric's five parts (V2 §7.8). */
export type AtsComponentKey = 'keywords' | 'timeline' | 'sections' | 'formatting' | 'achievements';

export type AtsComponent = {
  key: AtsComponentKey;
  label: string;
  /** Its weight, in points of 100. */
  weight: number;
  /** The part's own score, 0–100; null when it is not measured (keywords without a JD, D-15). */
  score: number | null;
  /** The points it adds to the total, to one decimal. */
  points: number | null;
  /** What it rests on, in words: "5 of 6 bullets show a measured outcome". */
  basis: string;
};

export type AtsRequirementStatus = 'met' | 'partial' | 'gap' | 'eligibility';

/** One line of the requirement ledger (Q-04, D-14). */
export type AtsRequirement = {
  id: string;
  /** As the JD words it. */
  text: string;
  importance: 'required' | 'preferred';
  status: AtsRequirementStatus;
  /** How the document backs it: in a dated role, only listed, or not at all. */
  evidence: 'demonstrated' | 'listed' | 'unbacked' | null;
  /** "5+ years" against what the dated roles show, in years to one decimal. */
  years?: { asked: number; shown: number };
  /** Set when the document words the skill differently from the JD. */
  documentWording?: string;
};

export type AtsFixType =
  | 'surface_backed_skill'
  | 'gap'
  | 'ask_for_number'
  | 'complete_section'
  | 'formatting'
  | 'mirror_wording'
  | 'resolve_timeline';

/** A typed fix (C-10). A gap is never insertable and worth no points. */
export type AtsFix = {
  id: string;
  type: AtsFixType;
  label: string;
  /** Points the change adds, simulated by re-scoring (one decimal); 0 for a gap. */
  impact: number;
  /** Whether the product may make the change itself. Only a skill the profile backs qualifies. */
  insertable: boolean;
  requirementId?: string;
  roleId?: string;
  skill?: string;
  section?: AtsFixTarget;
  /** What it rests on, in words (G17): "You tagged it at Acme." A score written before §146 has none. */
  basis?: string;
};

/** A technology claim the timeline engine flagged (V2 §7.7). */
export type AtsTimelineFlag = {
  roleId: string;
  skill: string;
  verdict: 'invalid' | 'suspect' | 'unverified';
  /** Why, in words. */
  reason: string;
  /** Era-appropriate alternatives to confirm, never auto-inserted. */
  substitutions: string[];
};

export type AtsReport = {
  /** 0–100, or null without a JD (D-15). */
  total: number | null;
  components: AtsComponent[];
  /** JD match %, reported apart from the total, with "x of y required". */
  jdMatch: {
    percent: number;
    requiredMet: number;
    requiredPartial: number;
    requiredTotal: number;
    preferredMet: number;
    preferredTotal: number;
    completeness: 'full' | 'snippet';
  } | null;
  requirements: AtsRequirement[];
  fixes: AtsFix[];
  timeline: {
    checked: number;
    valid: number;
    suspect: number;
    invalid: number;
    unverified: number;
    flags: AtsTimelineFlag[];
  };
  /** Skills the document shows that the profile does not back. */
  unbacked: string[];
  /** Claims that cannot be true: years past a technology's age, dates that don't add up (§129). */
  plausibility?: PlausibilityNote[];
  notMeasured: string[];
  provenance: {
    engine: string;
    rubric: string;
    taxonomy: string;
    kb: string;
    asOf: string;
    reason: 'content_change' | 'method_change';
  };
};

export type ScoreLead = { headline: string; detail: string };

/**
 * What a score card leads with (toreview §146.1): how much of what the job requires the resume
 * shows, ahead of the total. Null with nothing to count against (D-15).
 */
export function scoreLead(report: Pick<AtsReport, 'jdMatch'> | undefined): ScoreLead | null {
  const match = report?.jdMatch;
  if (!match) return null;
  if (match.requiredTotal > 0) {
    const { requiredMet: met, requiredPartial: partly, requiredTotal: total } = match;
    const missing = total - met - partly;
    const rest = [partly > 0 ? `${partly} partly` : '', missing > 0 ? `${missing} missing` : ''];
    return {
      headline: `${met} of ${total} required`,
      detail: rest.filter(Boolean).join(' · ') || 'All of them met',
    };
  }
  if (match.preferredTotal > 0) {
    return {
      headline: `${match.preferredMet} of ${match.preferredTotal} listed`,
      detail: 'The job marks none as required',
    };
  }
  return null;
}

/** What the report adds to the count: what the profile could win back, and any conflict. */
function summaryNotes(report: AtsReport): string[] {
  const notes: string[] = [];
  const backed = report.fixes.filter((f) => f.type === 'surface_backed_skill');
  if (backed.length > 0) {
    const gain = Math.round(backed.reduce((sum, f) => sum + f.impact, 0) * 10) / 10;
    notes.push(`${backed.length} ${backed.length === 1 ? 'skill' : 'skills'} your profile backs could add ${gain} points.`);
  }
  if (report.timeline.flags.some((f) => f.verdict === 'invalid')) notes.push('A technology claim conflicts with its role’s dates.');
  return notes;
}

/** The line under the band, led by the job match (G17). Never chosen from the total. */
export function summaryFor(report: AtsReport): string {
  const parts: string[] = [];
  if (report.jdMatch && report.jdMatch.requiredTotal > 0) {
    const { requiredMet, requiredTotal, requiredPartial } = report.jdMatch;
    parts.push(`Meets ${requiredMet} of ${requiredTotal} required skills${requiredPartial ? `, ${requiredPartial} partly` : ''}.`);
  } else if (report.jdMatch && report.jdMatch.preferredTotal > 0) {
    parts.push(`Shows ${report.jdMatch.preferredMet} of ${report.jdMatch.preferredTotal} skills the job lists.`);
  }
  parts.push(...summaryNotes(report));
  if (parts.length === 0) parts.push('Every check this score rests on is listed below.');
  return parts.join(' ');
}

/** The same line under a `scoreLead`, which has already said the count. */
export const summaryAfterLead = (report: AtsReport): string => summaryNotes(report).join(' ');

/** Band thresholds shared by fixtures and UI meters. */
export function atsBandFor(total: number): AtsBand {
  if (total >= 85) return 'strong';
  if (total >= 70) return 'good';
  if (total >= 55) return 'fair';
  return 'weak';
}

/** The library's sort control (Figma 1:1378 draws it reading "Last edited"). */
export type ResumeSort = 'edited' | 'created' | 'name' | 'score';

export const RESUME_SORT_LABEL: Record<ResumeSort, string> = {
  edited: 'Last edited',
  created: 'Newest first',
  name: 'Name',
  score: `Highest ${SCORE_LABEL}`,
};

/**
 * Comparators kept beside the model so the repo's `list()` can adopt them verbatim when paging
 * arrives; until then the query sorts in memory (see `useResumes`). Unscored documents sort after
 * scored ones under 'score' rather than as zero, and every order breaks ties on the title so the
 * list is stable across refetches.
 */
export const RESUME_SORT_COMPARATORS: Record<ResumeSort, (a: Resume, b: Resume) => number> = {
  edited: (a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title),
  created: (a, b) => b.createdAt.localeCompare(a.createdAt) || a.title.localeCompare(b.title),
  name: (a, b) => a.title.localeCompare(b.title),
  score: (a, b) => (b.atsScore ?? -1) - (a.atsScore ?? -1) || a.title.localeCompare(b.title),
};

export const sortResumes = (resumes: readonly Resume[], sort: ResumeSort): Resume[] =>
  [...resumes].sort(RESUME_SORT_COMPARATORS[sort]);

/** Unmet, actionable items — the count behind "Fix 4 quick wins" (Figma 1:2187). */
export function atsQuickWins(score: AtsScore): AtsCheckItem[] {
  return score.sections.flatMap((section) => section.items.filter((i) => !i.passed && i.fixable));
}

/** "4 of 5" — how a section header summarises its checklist (Figma 1:2124). */
export function atsSectionPassed(section: AtsSection): number {
  return section.items.filter((item) => item.passed).length;
}
