import type { EmploymentType, ExperienceLevel } from './job';

/**
 * A job description understood (toreview §153): every fact the posting states, in its place, with
 * the words it came from. One shape whatever the source (paste, file or link), so the page, the
 * match and tailoring read the same thing. The model proposes and code decides (G14): each fact is
 * kept only when its quote is found in the text, numbers are parsed from that quote by code, and
 * contradictions are flagged rather than resolved. Nothing the posting does not say is filled in.
 */
export const JD_STRUCTURE_VERSION = 2;

/** Where a fact sits in the posting's text: offsets into `JdDraft.rawText`. */
export type JdQuote = { text: string; start: number; end: number };

/**
 * How sure the reading is (no confidence numbers: the model gives none that are calibrated):
 * `stated` the words say it; `interpreted` placed from context; `unclear` the posting is
 * ambiguous or contradicts itself, and the page says so.
 */
export type JdFactStatus = 'stated' | 'interpreted' | 'unclear';

/** One fact and its evidence. A repeated fact keeps every quote it was said in. */
export type JdFact<T = string> = { value: T; quotes: JdQuote[]; status: JdFactStatus };

export type WorkMode = 'onsite' | 'remote' | 'hybrid' | 'field' | 'flexible';
export type SkillCategory =
  'language' | 'framework' | 'database' | 'cloud' | 'tool' | 'api' | 'domain' | 'soft' | 'other';
export type Importance = 'required' | 'preferred';
export type PayPeriod = 'hour' | 'day' | 'week' | 'month' | 'year';
export type PayComponent =
  'base' | 'fixed' | 'variable' | 'incentive' | 'bonus' | 'total' | 'unknown';

/** A pay figure as the posting states it; the numbers are parsed from the quote by code. */
export type PayStatement = {
  component: PayComponent;
  min?: number;
  max?: number;
  currency?: string;
  period?: PayPeriod;
};

export type JdLocation = {
  label: string;
  city?: string;
  region?: string;
  country?: string;
};

export type ScheduleKind =
  'days' | 'hours' | 'shift' | 'weekends' | 'overtime' | 'travel' | 'joining' | 'other';

export type EligibilityKind =
  'age' | 'work_authorization' | 'location' | 'gender' | 'background_check' | 'other';

export type ApplicationKind = 'method' | 'url' | 'email' | 'deadline' | 'documents' | 'process';

export type LanguageLevel = 'basic' | 'intermediate' | 'advanced' | 'fluent' | 'native';

/** Something the reader should know: two parts of the posting disagree, or one is unclear. */
export type JdIssue = {
  kind: 'conflict' | 'ambiguous' | 'sensitive' | 'expired';
  /** The part of the reading it is about: `compensation`, `experience`, `workMode`… */
  field: string;
  /** Plain words, naming what the posting says ("1 year minimum, and freshers may apply"). */
  note: string;
  quotes: JdQuote[];
  /** Raised by code's checks, or reported by the model and kept because its quotes are real. */
  by: 'rules' | 'model';
};

export type JdStructured = {
  schemaVersion: typeof JD_STRUCTURE_VERSION;
  identity: {
    title?: JdFact;
    company?: JdFact;
    department?: JdFact;
    industry?: JdFact;
    employmentType?: JdFact<EmploymentType>;
    seniority?: JdFact<ExperienceLevel>;
    openings?: JdFact<number>;
    referenceId?: JdFact;
  };
  /**
   * Two or three sentences NextKin wrote from the posting, labelled as ours wherever shown: the
   * one part not quoted, so it never feeds matching or tailoring.
   */
  summary?: string;
  locations: JdFact<JdLocation>[];
  workMode?: JdFact<WorkMode>;
  schedule: (JdFact & { kind: ScheduleKind; daysPerWeek?: number })[];
  compensation: {
    statements: JdFact<PayStatement>[];
    /** One range, only when every statement agrees; `unclear` otherwise. */
    range?: JdFact<PayStatement>;
    negotiable?: JdFact<boolean>;
  };
  experience: {
    minYears?: JdFact<number>;
    maxYears?: JdFact<number>;
    freshersOk?: JdFact<boolean>;
    /** The posting's own experience lines ("1 year in fintech", "led a team"). */
    lines: JdFact[];
  };
  responsibilities: (JdFact & { group?: string })[];
  skills: (JdFact & { category: SkillCategory; importance: Importance })[];
  education: (JdFact & { importance: Importance })[];
  languages: (JdFact & { importance: Importance; level?: LanguageLevel })[];
  benefits: JdFact[];
  eligibility: (JdFact & { kind: EligibilityKind; sensitive: boolean })[];
  company: { about: JdFact[]; website?: JdFact };
  application: (JdFact & { kind: ApplicationKind })[];
  /** Real content that fits no section, so nothing the posting says is silently lost. */
  extras: JdFact[];
  issues: JdIssue[];
  /** What the checks kept and dropped, for the trace. */
  stats: { kept: number; dropped: number; merged: number };
};
