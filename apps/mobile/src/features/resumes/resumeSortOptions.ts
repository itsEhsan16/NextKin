import { RESUME_SORT_LABEL, type ResumeSort } from '@/data/models';
import type { SheetOption } from '@/ui/OptionSheet';

/**
 * The library's sort picker (RESUMES 01 "Last edited ▾"; the sheet has no artboard and follows
 * the jobs sort sheet). Reading order is the union's, leading with the default.
 */
export const RESUME_SORT_OPTIONS: readonly SheetOption<ResumeSort>[] = (
  ['edited', 'created', 'name', 'score'] as const
).map((key) => ({ key, label: RESUME_SORT_LABEL[key] }));
