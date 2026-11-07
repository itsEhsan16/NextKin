import type { Resume } from '@/data/models';
import { storage } from '@/lib/storage';

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

const ASKED_KEY = 'onboarding.firstResumeAsked';

/**
 * Whether this account has been asked for its first resume (owner, 2026-11-08, §186). It is asked
 * ONCE: on the start screen after sign-up, or by Home's pop-up for someone who never saw that
 * screen. Any answer counts, Skip and "Not now" included, and it is kept on the device so it is
 * never asked again on Home. After that a resume is asked for only where one is needed: Tailor,
 * ATS Check, Cover letter and Build each offer upload / build / answer questions in place. A new
 * sign-up on this phone starts fresh.
 */
export const firstResumeAsked = {
  wasAsked: (): boolean => storage.get<boolean>(ASKED_KEY) === true,
  markAsked: (): void => storage.set(ASKED_KEY, true),
  reset: (): void => storage.remove(ASKED_KEY),
};
