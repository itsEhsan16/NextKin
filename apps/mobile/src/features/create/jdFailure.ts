import type { JdDraft, JdFailureReason } from '@/data/models';

/**
 * Why a job description could not be read, in a line (toreview §206, §259, §262), the web's own
 * words (apps/web/src/features/jd/components/JdEditPanel.tsx). Each says what happened; the
 * screen adds what to do next.
 */
const FAILED_LEDE: Partial<Record<JdFailureReason, string>> = {
  unreadable: 'We couldn’t read this as a job description.',
  listing: 'That link opened a list of jobs, not one posting.',
  removed: 'This posting is no longer available.',
  gone: 'This posting is no longer available.',
  not_a_job: 'We couldn’t find a job description in what you gave us.',
  busy: 'Our reading service was busy when you added this.',
  service_down: 'Reading job descriptions isn’t working on our side right now.',
  too_long: 'This description was too long to read in one go.',
  unclear: 'We couldn’t make sense of this as one job’s description.',
  internal: 'Something went wrong on our side while reading this.',
};

/** The line for a failed reading: its reason's, else the server's own sentence, else a plain one. */
export const jdFailedLede = (draft: Pick<JdDraft, 'failureReason' | 'error'>): string =>
  (draft.failureReason ? FAILED_LEDE[draft.failureReason] : undefined) ??
  draft.error ??
  'We couldn’t read this job description.';
