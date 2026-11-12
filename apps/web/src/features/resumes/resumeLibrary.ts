import type { Resume, ResumeSort, ResumeVariant } from '@nextkin/shared/models';

import type { TagTone } from '@/ui/Tag';

/**
 * How the Resumes board (286:1675) sorts its documents into kinds and states. Each row carries
 * two tags: what kind of document it is, and what state it is in. The pills over the list count
 * both. See `toreview.md` §18.
 */

/** The first tag (304:3146, 3170, 3194). */
export const VARIANT_LABEL: Record<ResumeVariant, string> = {
  tailored: 'Tailored',
  // "Default" read as "my default resume" (owner, toreview §124): this one is not written for a job.
  default: 'General',
  template: 'Template',
};

/** What each tag means, for its tooltip and screen readers (toreview §124). */
export const VARIANT_HINT: Record<ResumeVariant, string> = {
  tailored: 'Written for a specific job description',
  default: 'Not written for a specific job: your general-purpose resume',
  template: 'A starting point to copy from',
};

export const VARIANTS = Object.keys(VARIANT_LABEL) as ResumeVariant[];

export const VARIANT_TONE: Record<ResumeVariant, TagTone> = {
  tailored: 'success',
  default: 'brand',
  template: 'brand',
};

/** The second tag (304:3148, 3196, 3244). */
export type ResumeState = 'ats_optimized' | 'draft' | 'archived';

export const STATE_LABEL: Record<ResumeState, string> = {
  ats_optimized: 'ATS Optimized',
  draft: 'Draft',
  archived: 'Archived',
};

export const STATE_HINT: Record<ResumeState, string> = {
  // The flag is the formatting checks alone (`scoring/report.ts`), not the whole rubric and not
  // fit for a job (redesign R6a, audit RS-03; the label's rename waits on the owner).
  ats_optimized:
    'Passes every formatting check in NextKin’s rubric. Says nothing about fit for a job.',
  draft: 'Not finished: it needs more before it can be downloaded',
  // All lists archived documents too, as the board draws (304:3245), so the hint says so
  // (redesign R6a, audit RS-04: it used to say "Hidden from your main list").
  archived: 'Set aside, still listed under All',
};

export const STATES = Object.keys(STATE_LABEL) as ResumeState[];

export const STATE_TONE: Record<ResumeState, TagTone> = {
  ats_optimized: 'brand',
  draft: 'neutral',
  archived: 'neutral',
};

/**
 * A document shows one state: set aside wins over unfinished, which wins over optimized. A ready
 * document that has not passed the ATS checks shows none.
 */
export function stateOf(resume: Resume): ResumeState | undefined {
  if (resume.archived) return 'archived';
  if (resume.draft) return 'draft';
  if (resume.validation?.atsOptimized) return 'ats_optimized';
  return undefined;
}

/**
 * The pills (304:3097), in the board's order. All counts archived documents too, as drawn; the
 * Archived pill shows only while something is archived (redesign R6a, audit RS-05).
 */
export type ResumeTab = 'all' | 'tailored' | 'ats_optimized' | 'drafts' | 'archived';

export const RESUME_TABS: readonly { id: ResumeTab; label: string }[] = [
  { id: 'all', label: 'All Resumes' },
  { id: 'tailored', label: 'Tailored' },
  { id: 'ats_optimized', label: 'ATS Optimized' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'archived', label: 'Archived' },
];

export function inTab(tab: ResumeTab, resume: Resume): boolean {
  switch (tab) {
    case 'all':
      return true;
    case 'tailored':
      return resume.variant === 'tailored';
    case 'ats_optimized':
      return stateOf(resume) === 'ats_optimized';
    case 'drafts':
      return stateOf(resume) === 'draft';
    case 'archived':
      return stateOf(resume) === 'archived';
  }
}

export function countByTab(resumes: Resume[]): Record<ResumeTab, number> {
  const counts = {} as Record<ResumeTab, number>;
  for (const { id } of RESUME_TABS)
    counts[id] = resumes.filter((resume) => inTab(id, resume)).length;
  return counts;
}

/**
 * "Sort by: Last updated" (304:3122) and the panel's "Last updated" (304:3253), one order behind
 * both. The board draws only the default; the other three are ours, over the shared comparators.
 */
export const RESUME_SORT_OPTIONS: Record<ResumeSort, string> = {
  edited: 'Last updated',
  created: 'Recently created',
  name: 'Name',
  score: 'ATS score',
};

export const pagesLabel = (count: number): string => `${count} ${count === 1 ? 'page' : 'pages'}`;
