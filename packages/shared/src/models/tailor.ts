import type { FixPlan } from '../scoring/fixPlan';
import type { HeaderCheck, HeaderChoice } from '../scoring/headerChecks';
import { atsBandFor, type AtsBand, type Resume } from './resume';

/**
 * The resumes a tailor run can start from (TAILOR 01 606:2, W-TAILOR's dialog): finished resumes
 * only — a cover letter is not tailored, a document still generating has nothing to compare, and
 * an archived one or a blank draft is not one to send — the base first, then the most recently
 * edited, the order the boards list them in. Shared by the phone's sheet and the web's dialog.
 */
export function tailorableResumes(resumes: readonly Resume[], excludeId?: string): Resume[] {
  return resumes
    .filter(
      (resume) =>
        resume.docType !== 'cover_letter' &&
        resume.status === 'ready' &&
        !resume.archived &&
        !resume.draft &&
        resume.id !== excludeId,
    )
    .sort((a, b) => {
      if (Boolean(a.isBase) !== Boolean(b.isBase)) return a.isBase ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}

/** The pre-pick: the caller's resume when it is offered, else the base, else the first. */
export function defaultTailorPick(
  resumes: readonly Resume[],
  selectedResumeId?: string,
): string | undefined {
  const requested = resumes.find((resume) => resume.id === selectedResumeId);
  return (requested ?? resumes.find((resume) => resume.isBase) ?? resumes[0])?.id;
}

/**
 * The job-first tailoring flow (toreview §56): compare a resume with a job on NextKin, fix it,
 * download it, apply on the employer's site. These are the comparison's shapes and the pure
 * copy decisions the TAILOR boards draw, so every screen in the flow reads the same rules.
 */

/** Where a keyword came from: the job's required skills, or the wording of its responsibilities. */
export type TailorKeywordSource = 'required' | 'description';

export type TailorKeyword = {
  label: string;
  /** Already on the resume being compared. */
  onResume: boolean;
  /**
   * How the resume shows it (D-14), when it does: used in a dated role (full credit), only in the
   * skills list (part credit), or for fewer years than the job asks (part credit). Unset on the
   * mock's comparisons, which only know on or off.
   */
  shown?: TailorKeywordShown;
  source: TailorKeywordSource;
  /** The job description's own line that asks for it (toreview §112). */
  quote?: string;
  /** One of the job's ~10 most important keywords: the ones step 1 shows (toreview §113). */
  top?: boolean;
  /** A soft skill ("communication"): offered in its own group, never in the job match. */
  kind?: 'skill' | 'soft';
};

export type TailorKeywordShown = 'experience' | 'listed' | 'fewer_years';

/** `skills` is BUILD 04b's "Skill order" row (663:117). */
export type TailorImprovementKey = 'headline' | 'summary' | 'length' | 'layout' | 'skills' | 'years';

/** One "What to improve" row (TAILOR 02 607:2). `ok` rows are the reassurance, not a fix. */
export type TailorImprovement = {
  key: TailorImprovementKey;
  label: string;
  detail: string;
  ok: boolean;
};

/** A resume measured against one job, before anything is changed (TAILOR 02). */
export type TailorComparison = {
  resumeId: string;
  /** The listing compared with, when it was one; a pasted or linked JD has none (toreview §110). */
  jobId?: string;
  /** The extraction the run tailors to — generation reads it, exactly as the JD flow's does. */
  jdId: string;
  /** The ATS score against THIS job, not the document's general one. */
  score: number;
  /** False when the JD gave the engine nothing to score (D-15): `score` is then 0, not a total. */
  scored?: boolean;
  keywords: TailorKeyword[];
  improvements: TailorImprovement[];
  /** Pages the resume runs to today; the length row and "Trimmed from 3 pages to 2" read it. */
  pageCount?: number;
  /** `pageCount` is the line-budget estimate (`scoring/pages.ts`), not a rendered count. */
  pagesEstimated?: boolean;
  /** How many of the job's keywords the resume shows, the way outside checkers count (§112). */
  jobMatch?: JobMatch;
  /** Where a ticked keyword may be said to have been used: the resume's roles and projects. */
  places?: TailorPlace[];
  /**
   * Where each missing keyword fits, decided beforehand from the places' own lines (toreview §163):
   * place ids, best first. A keyword with none is a skills-list keyword only.
   */
  picks?: Record<string, string[]>;
  /** "Your fix plan" (toreview §115): where the points go, and the steps ranked by worth. */
  plan?: FixPlan;
  /** Header statements that don't fit this job (toreview §170), asked in Enhance. */
  headerChecks?: HeaderCheck[];
};

/**
 * "Job match" (toreview §112, owner): of the keywords this JD names, how many the resume shows
 * anywhere, in its skills, summary, roles or projects. Soft skills are not counted. Its basis
 * says so (G17); the ATS score beside it is the fuller measure.
 */
export type JobMatch = {
  matched: number;
  total: number;
  percent: number;
  missing: string[];
  basis: string;
};

/** A role or project of the base resume a keyword can be confirmed at. */
export type TailorPlace = { id: string; label: string };

/**
 * A ticked keyword the user says they used, and where (toreview §112): it becomes a fact on that
 * role or project, so the run may write it there and in the summary.
 */
export type TailorConfirmation = {
  keyword: string;
  where: string;
  note?: string;
  /** Who chose the place: the AI's pick the user kept, or the user (toreview §129). */
  by?: 'ai' | 'you';
};

/**
 * A bullet the user rewrote with its real result (toreview §129): "Cut checkout time by 30%".
 * `where` is the role, `line` the bullet's index in the base resume. It replaces that line, and is
 * the user's own words, so a tailored line citing it may state the figure.
 */
export type TailorFigure = { where: string; line: number; text: string };

/**
 * "Add the result", drafted (owner, toreview §129): the bullet reads `before` + the user's figure +
 * `after`. The AI never writes the figure; `hint` says what kind of figure goes there. `by: 'rules'`
 * is the plain fallback ("…, improving ___").
 */
export type FigureDraft = {
  before: string;
  after: string;
  hint: string;
  by: 'model' | 'rules';
  /**
   * An AI guess at the figure (owner, 2026-11-06; toreview §173), shown as a dashed "AI guess" the
   * user must accept or edit — never written without that tap. The live server does not send one
   * yet: its guard G13 still forbids the model writing a figure, pending the owner's decision.
   */
  suggestion?: string;
};

/** The plain draft: the line as written, with the gap after "improving". */
export function fallbackFigureDraft(line: string): FigureDraft {
  return { before: `${line.trim().replace(/[.;,\s]+$/, '')}, improving`, after: '.', hint: 'what improved, and by how much', by: 'rules' };
}

/** The finished line: the draft with the user's figure in its gap. */
export function figureLine(draft: Pick<FigureDraft, 'before' | 'after'>, figure: string): string {
  const after = draft.after.trim();
  const glue = after === '' || /^[.,;:!?)]/.test(after) ? '' : ' ';
  return `${draft.before.trim()} ${figure.trim()}${glue}${after}`;
}

/** The add-or-skip answers TAILOR 03 collects for each missing keyword. */
export type TailorChoices = { added: string[]; skipped: string[] };

/**
 * The parts of a resume the web flow lets the user leave alone (W-TAILOR 02, 734:679): all on by
 * default. `experience` is rewritten for the two latest roles (`quick`) or every role (`full`).
 */
export type TailorFix = 'headline' | 'summary' | 'skills' | 'experience' | 'projects' | 'length';
export type TailorExperienceDepth = 'quick' | 'full';

/** What a tailoring run remembers, so its ready screen can say what changed (TAILOR 05). */
export type TailorRun = TailorChoices & {
  /** The web flow's choices; mobile's runs leave them unset, which means "all of them". */
  fixes?: TailorFix[];
  experience?: TailorExperienceDepth;
  sourceResumeId: string;
  /** The comparison's score, for "Up from 72". */
  baselineScore: number;
  /** Pages the source ran to, when the run trimmed it. */
  sourcePages?: number;
  /** The server's run (toreview §110.3): the score the new version got against the JD. */
  score?: number;
  /** "What changed for this job", worked out from the two versions, not from the request. */
  changes?: TailorChange[];
  /** Lines the run could not back and left out (G13). */
  stripped?: number;
  /** Ticked keywords with where the user used them (toreview §112). */
  confirmed?: TailorConfirmation[];
  /** Bullets the user rewrote with their real result (toreview §129). */
  figures?: TailorFigure[];
  /** The user's answers to the header checks (toreview §170). */
  header?: HeaderChoice[];
  /**
   * What the plan promised for these choices, out of 100: the resume with the user's answers and
   * the AI's own steps, re-scored at the start (toreview §129). The ready screen compares `score`.
   */
  projected?: number;
  /** The new version's job match, against the same keywords as the comparison's. */
  jobMatch?: JobMatch;
  /** The comparison's job match, which the new one is measured against. */
  baselineJobMatch?: JobMatch;
  /** How many pages the new version runs to: compiled when `pageBasis` does not say "estimated". */
  pages?: number;
  /** Why it has that length (G17), e.g. "Fitted to 1 page: under 5 years of experience". */
  pageBasis?: string;
};

/** The page length a tailored resume is cut to; recruiters skim one or two (TAILOR 02). */
export const TAILOR_TARGET_PAGES = 2;

export const missingKeywords = (comparison: TailorComparison): TailorKeyword[] =>
  comparison.keywords.filter((keyword) => !keyword.onResume);

export const fixCount = (comparison: TailorComparison): number =>
  comparison.improvements.filter((row) => !row.ok).length;

/** "A good start. Let's make it stronger" — the TAILOR 02 hero, by band. */
export function tailorHeadline(score: number): {
  title: string;
  lede: (company: string) => string;
} {
  const band: AtsBand = atsBandFor(score);
  if (band === 'strong') {
    return {
      title: 'A strong match.\nA few touches left',
      lede: (company) =>
        `Your resume already covers what ${company} asks for. A couple of fixes will polish it.`,
    };
  }
  if (band === 'good') {
    return {
      title: 'A good start.\nLet’s make it stronger',
      lede: (company) =>
        `Your resume covers most of what ${company} asks for. A few fixes will lift its ATS score.`,
    };
  }
  return {
    title: 'Some work to do.\nLet’s close the gaps',
    lede: (company) =>
      `Your resume misses several things ${company} asks for. The fixes below will lift its ATS score.`,
  };
}

/** One "What changed for this job" row (TAILOR 05 608:267). `left` rows are the skipped ones. */
export type TailorChange = { label: string; left: boolean };

const joinList = (items: readonly string[]): string =>
  items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** Only what the run did — never a change it did not make (toreview §56.2). */
export function tailorChanges(run: TailorRun): TailorChange[] {
  const changes: TailorChange[] = [
    { label: 'Headline and summary aimed at this role', left: false },
  ];
  if (run.added.length > 0) {
    changes.push({
      label: `Added ${joinList(run.added.map((k) => k.toLowerCase()))}`,
      left: false,
    });
  }
  if (run.sourcePages != null && run.sourcePages > TAILOR_TARGET_PAGES) {
    changes.push({
      label: `Trimmed from ${run.sourcePages} pages to ${TAILOR_TARGET_PAGES}`,
      left: false,
    });
  }
  for (const skipped of run.skipped) {
    changes.push({
      label: `${skipped.split(/[ /]/)[0]} left out, as you chose`,
      left: true,
    });
  }
  return changes;
}
