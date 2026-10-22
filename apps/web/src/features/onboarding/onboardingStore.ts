import type { CareerGoal, ExperienceBand } from '@nextkin/shared/models';
import { create } from 'zustand';

import type { ResumeChoice } from './onboardingOptions';

/**
 * The answers as they are being given in web onboarding (ONB 01–04, `toreview.md` §107), which
 * "Your profile so far" reads while the user is still typing. Each step seeds them from the
 * account and profile, and writes them back when it continues. The resume choice only picks the
 * way on, so it is never saved.
 *
 * In memory only: a reload starts the questions again from what the profile already holds.
 */
/** One role on ONB 05 (816:8–816:32). Months are `YYYY-MM`; `to` is `'present'` for a current role. */
export type RoleAnswer = {
  /** The profile entry it edits, or a new id the server replaces on create. */
  id: string;
  title: string;
  company: string;
  from: string | null;
  to: string | null;
  /** The role's own skill tags, carried through untouched when it edits an existing entry. */
  skills: string[];
};

/** ONB 07's answer (816:145–816:161). `year` is the year finished, as text ("2017"). */
export type EducationAnswer = {
  /** The profile entry it edits, or a new id the server replaces on create. */
  id: string;
  degree: string;
  school: string;
  year: string | null;
};

export type OnboardingAnswers = {
  /** `undefined` until typed, so the field can start from the account's own name. */
  name?: string;
  goal?: CareerGoal;
  targetRole?: string;
  experience?: ExperienceBand;
  jobTitle?: string;
  resume?: ResumeChoice;
  /** The resume read on ONB 04b, by its file name ("George_Smith_CV.pdf"). */
  resumeFile?: string;
  /** What reading it found ("Read · 4 roles and 12 skills found"), for coming back to ONB 04b. */
  resumeSummary?: string;
  /** ONB 05's roles, most recent first; `undefined` until seeded from the profile. */
  roles?: RoleAnswer[];
  /** ONB 05's "I haven't worked yet — skip this" (816:34). */
  noWork?: boolean;
  /** ONB 06's picked skills; `undefined` until seeded from the profile. */
  skills?: string[];
  /** ONB 07's education; `undefined` until seeded from the profile. */
  education?: EducationAnswer;
};

type OnboardingState = OnboardingAnswers & {
  answer: (patch: Partial<OnboardingAnswers>) => void;
  reset: () => void;
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  answer: (patch) => set(patch),
  reset: () =>
    set({
      name: undefined,
      goal: undefined,
      targetRole: undefined,
      experience: undefined,
      jobTitle: undefined,
      resume: undefined,
      resumeFile: undefined,
      resumeSummary: undefined,
      roles: undefined,
      noWork: undefined,
      skills: undefined,
      education: undefined,
    }),
}));
