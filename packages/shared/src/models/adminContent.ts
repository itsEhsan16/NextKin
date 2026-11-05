/**
 * The admin portal's Content area: AI prompts and their versions and evals, the technology KB and
 * its review queue, skills and aliases, templates, the ATS rubric (Figma 406:662–410:1771).
 *
 * A part the data source doesn't serve yet is `null`, and the screen says so in place: the backend
 * has no skills editor, template previews or prompt sandbox yet (`toreview.md` §171.4).
 */

/** A write the data source can't make yet (the backend has no route for it). */
export class ContentNotServedError extends Error {
  constructor(what: string) {
    super(`The backend doesn’t support ${what} yet.`);
    this.name = 'ContentNotServedError';
  }
}

// --- AI prompts (`adminPrompts.ts`) --------------------------------------------------------------

export * from './adminPrompts';

// --- Technology KB ------------------------------------------------------------------------------

export type TechnologyStatus = 'in_review' | 'published' | 'needs_source' | 'reported';

export type Technology = {
  id: string;
  name: string;
  category: string;
  aliases: string[];
  latestVersion: string | null;
  /** An ISO date, or a bare year (`"2024"`) where only the year is known. */
  releaseDate: string | null;
  /** Whether a release date has a cited source. */
  source: 'cited' | 'missing';
  sourceUrl: string | null;
  dataset: string;
  updatedAt: string;
  updatedBy: string;
  status: TechnologyStatus;
};

export type KbTab = 'all' | 'review' | 'reports' | 'imports';

/** Counts the source can't break down are `null`; the card then shows the total alone. */
export type KbStats = {
  technologies: { total: number; added30d: number | null };
  review: { total: number; fromImports: number | null; staffEdits: number | null };
  reports: { total: number; dates: number | null; aliases: number | null };
  dataset: { version: string; closedAt: string | null; nextAt: string | null } | null;
  tabs: Record<KbTab, number | null>;
};

export type TechnologyPage = { rows: Technology[]; total: number; page: number; pageSize: number };

export type TechnologyInput = {
  name: string;
  category: string;
  aliases: string[];
  latestVersion: string | null;
  releaseDate: string | null;
  sourceUrl: string | null;
};

export type KbImportResult = {
  imported: number;
  failed: { row: number; reason: string }[];
};

export type KbChangeOrigin = 'import' | 'user_report' | 'staff_edit';

export type KbChangeKind = 'date' | 'version' | 'alias' | 'new' | 'report' | 'category';

export type KbFieldChange =
  | { field: string; from: string | null; to: string | null }
  | { field: string; unchanged: string[] };

export type KbUserReport = { id: string; title: string; body: string; at: string; origin: string };

/** One change waiting in the review queue (Figma 410:1771). */
export type KbChange = {
  id: string;
  title: string;
  kind: KbChangeKind;
  origin: KbChangeOrigin;
  originLabel: string;
  at: string;
  detail: {
    heading: string;
    technology: string;
    proposedBy: string;
    resumesAffected: string;
    targetDataset: string;
    fields: KbFieldChange[];
    source: { url: string; cited: boolean; note: string } | null;
    reports: KbUserReport[];
  };
};

export type KbDecision = 'approve' | 'reject';

/** Approving a release date without a cited source is refused (P12-04). */
export class SourceRequiredError extends Error {
  constructor() {
    super('Approving a release date needs a cited source.');
    this.name = 'SourceRequiredError';
  }
}

/** Whether a cited source is a web address (`https://nextjs.org/blog/next-15-1`). */
export const isSourceUrl = (value: string): boolean =>
  /^https?:\/\/[a-z\d-]+(\.[a-z\d-]+)+([/?#]\S*)?$/i.test(value.trim());

/** A cited source that isn't a web address is refused: a date's source must be checkable. */
export class SourceUrlError extends Error {
  constructor() {
    super('A cited source has to be a web address, starting https://.');
    this.name = 'SourceUrlError';
  }
}

/** An edit that changes nothing has nothing to review. */
export class NothingChangedError extends Error {
  constructor(name: string) {
    super(`Nothing about ${name} changed, so there's nothing to send for review.`);
    this.name = 'NothingChangedError';
  }
}

// --- Skills & aliases ---------------------------------------------------------------------------

export type TaxonomyCategory = { id: string; name: string; count: number };

export type Skill = {
  id: string;
  name: string;
  aliases: string[];
  parent: string;
  categoryId: string;
  usedIn: number;
  editedAt: string;
  editedBy: string;
};

export type SkillsAliasFilter = 'all' | 'with' | 'none';

export type UnmappedTerm = { term: string; seenIn: number };

export type MergeSuggestion = {
  id: string;
  alias: string;
  target: string;
  seenIn: number;
  firstSeen: string;
};

export type SkillsOverview = {
  stats: {
    skills: number;
    added30d: number;
    aliases: number;
    perSkill: number;
    merges: number;
    unmapped: number;
  };
  categories: TaxonomyCategory[];
  unmapped: UnmappedTerm[];
  merges: MergeSuggestion[];
};

export type SkillPage = { rows: Skill[]; total: number; page: number; pageSize: number };

// --- Templates ----------------------------------------------------------------------------------

export type TemplateStatus = 'published' | 'draft' | 'archived';

/** Which drawing the card's thumbnail uses; the real preview renders the template itself. */
export type TemplateLayout = 'jake' | 'modern' | 'elegant' | 'compact' | 'executive' | 'classic';

export type ResumeTemplate = {
  slug: string;
  name: string;
  layout: TemplateLayout;
  /** `true` once certified ATS-safe; `false` while the check is pending. */
  atsSafe: boolean;
  status: TemplateStatus;
  rev: number;
  inUse: number;
  editedAt: string;
  editedBy: string;
  archivedAt: string | null;
};

export type TemplateSort = 'most_used' | 'recent' | 'name';

/** Publishing a template that isn't certified ATS-safe is refused (Q-06). */
export class NotCertifiedError extends Error {
  constructor(name: string) {
    super(`${name} can't be published until its ATS check passes and it's signed off.`);
    this.name = 'NotCertifiedError';
  }
}

// --- ATS rubric ---------------------------------------------------------------------------------

export type RubricVersionStatus = 'draft' | 'active' | 'retired';

export type RubricCriterion = {
  key: string;
  label: string;
  description: string;
  /** A share of the total, 0–100. */
  weight: number;
  evidence: string;
};

export type RubricVersion = {
  version: number;
  status: RubricVersionStatus;
  author: string;
  /** "edited Nov 03, 2026", "published Sep 30, 2026", or a bare date for a retired one. */
  dateLabel: string;
  activeSince: string | null;
  criteria: RubricCriterion[];
};

export type RubricCheck = { label: string; detail: string; state: 'done' | 'pending' };

export type RubricEvidence = { title: string; detail: string };

export type RubricOverview = {
  versions: RubricVersion[];
  /** What the draft still needs before it can be published; empty with no draft. */
  checklist: RubricCheck[];
  rationale: { paragraphs: string[]; byline: string; evidence: RubricEvidence[] } | null;
  /** The dry run of the draft over recent checks; `null` where none has run. */
  impact: {
    meanFrom: number;
    meanTo: number;
    checks: number;
    note: string;
    passFrom: number;
    passTo: number;
  } | null;
};

/** Publishing a rubric draft before its checklist is complete is refused (G15). */
export class RubricNotReadyError extends Error {
  constructor(missing: string) {
    super(`This draft can't be published yet: ${missing}.`);
    this.name = 'RubricNotReadyError';
  }
}
