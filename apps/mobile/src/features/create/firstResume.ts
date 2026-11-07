import type { Resume } from '@/data/models';

/**
 * Where a new account stands on the way to its first resume made for a job (V2 §7.2's guided
 * checklist, toreview §145.2). It is worked out from what they have, not stored, so it can't drift:
 * a resume or a role is step one done, and a resume made for a job ends it.
 */
export type FirstResumeStage = 'add-resume' | 'pick-job' | 'done';

const isFinishedResume = (resume: Resume): boolean =>
  resume.docType !== 'cover_letter' &&
  resume.status === 'ready' &&
  !resume.draft &&
  !resume.archived;

export function firstResumeStage(resumes: readonly Resume[], roles: number): FirstResumeStage {
  const finished = resumes.filter(isFinishedResume);
  if (finished.some((resume) => resume.targetCompany || resume.targetRole)) return 'done';
  return finished.length > 0 || roles > 0 ? 'pick-job' : 'add-resume';
}
