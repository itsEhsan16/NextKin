import type { ApplicationStatus, ApplicationWithJob } from '@nextkin/shared/models';

import type { TagTone } from '@/ui/Tag';

/**
 * Where an application stands, in the web board's words (286:1234). The shared statuses carry
 * over with two renamings: "Screening" for `viewed` (mobile's "Applied · Viewed") and "Rejected"
 * for `not_selected` (mobile's "Not selected"). The board also draws one stage the model has no
 * status for, "Closed": an application still waiting on the employer when the listing's deadline
 * passed. That one is derived, never stored. See `toreview.md` §17.
 */
export type ApplicationStage = ApplicationStatus | 'closed';

export function stageOf(
  { application, job }: ApplicationWithJob,
  now = Date.now(),
): ApplicationStage {
  const waiting = application.status === 'applied' || application.status === 'viewed';
  const lapsed = job.closingAt != null && new Date(job.closingAt).getTime() < now;
  return waiting && lapsed ? 'closed' : application.status;
}

export const STAGE_LABEL: Record<ApplicationStage, string> = {
  applied: 'Applied',
  viewed: 'Screening',
  in_review: 'In Review',
  interview: 'Interview',
  offer: 'Offer',
  not_selected: 'Rejected',
  withdrawn: 'Withdrawn',
  closed: 'Closed',
};

/**
 * Pill colours as drawn (286:1337, 1366, 1395, 1454, 1486, 1543). "Applied" is undrawn and takes
 * the neutral pair Withdrawn and Closed share.
 */
export const STAGE_TONE: Record<ApplicationStage, TagTone> = {
  applied: 'neutral',
  viewed: 'warning',
  in_review: 'brand',
  interview: 'success',
  offer: 'success',
  not_selected: 'danger',
  withdrawn: 'neutral',
  closed: 'neutral',
};

/**
 * The status pills over the list (286:1269), in the board's order. Screening, Applied and Closed
 * have no pill of their own and count only toward All.
 */
export type StageTab = 'all' | 'in_review' | 'interview' | 'offer' | 'not_selected' | 'withdrawn';

export const STAGE_TABS: readonly { id: StageTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'in_review', label: 'In Review' },
  { id: 'interview', label: 'Interview' },
  { id: 'offer', label: 'Offer' },
  { id: 'not_selected', label: 'Rejected' },
  { id: 'withdrawn', label: 'Withdrawn' },
];

export const inTab = (tab: StageTab, stage: ApplicationStage): boolean =>
  tab === 'all' || tab === stage;

export function countByTab(rows: ApplicationWithJob[]): Record<StageTab, number> {
  const stages = rows.map((row) => stageOf(row));
  const counts = {} as Record<StageTab, number>;
  for (const { id } of STAGE_TABS) counts[id] = stages.filter((stage) => inTab(id, stage)).length;
  return counts;
}

/**
 * What "Update Status" offers (332:467): every status a candidate can record. Closed follows from
 * the listing's deadline, so it is never set by hand.
 */
export const SETTABLE_STATUSES: readonly ApplicationStatus[] = [
  'applied',
  'viewed',
  'in_review',
  'interview',
  'offer',
  'not_selected',
  'withdrawn',
];
