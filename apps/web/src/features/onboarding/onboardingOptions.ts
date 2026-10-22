import type { CareerGoal, ExperienceBand } from '@nextkin/shared/models';
import type { ComponentType, SVGProps } from 'react';

import {
  AssistantTermsIllustration,
  GoalBetterRoleIllustration,
  GoalExploringIllustration,
  GoalFirstJobIllustration,
  GoalNewFieldIllustration,
  JdArtUploadFileIllustration,
  NavUpgradeIllustration,
  ProfileEducationIllustration,
  ProfileExperienceIllustration,
  ProfileInsightsIllustration,
  ProfileSkillsIllustration,
} from '@/ui/illustrations';

type Art = ComponentType<SVGProps<SVGSVGElement>>;

export type IconTone = 'brand' | 'green' | 'blue' | 'amber';

/** ONB 02's four goals (826:23–826:88), each with its own bare illustration (827:134–827:165). */
export const GOALS: readonly {
  value: CareerGoal;
  label: string;
  hint: string;
  /** How the profile card names it beside the role ("Better role · Lead UX Designer"). */
  short: string;
  Art: Art;
}[] = [
  {
    value: 'first_job',
    label: 'Land my first job',
    hint: 'Student, new grad or first role',
    short: 'First job',
    Art: GoalFirstJobIllustration,
  },
  {
    value: 'better_role',
    label: 'Move to a better role',
    hint: 'Same field, next step up',
    short: 'Better role',
    Art: GoalBetterRoleIllustration,
  },
  {
    value: 'new_field',
    label: 'Switch to a new field',
    hint: 'Use what I know somewhere new',
    short: 'New field',
    Art: GoalNewFieldIllustration,
  },
  {
    value: 'exploring',
    label: 'Just exploring',
    hint: 'See what’s out there',
    short: 'Exploring',
    Art: GoalExploringIllustration,
  },
];

/** ONB 03's five bands (814:153–814:229), the same bands as ZERO 01's. */
export const EXPERIENCE_BANDS: readonly {
  value: ExperienceBand;
  label: string;
  /** The profile card's form ("6–10 yrs · Senior UX Designer"). */
  short: string;
  /** Whole years the band covers, to read a band off the profile's `yearsExperience`. */
  min: number;
  max: number;
  Art: Art;
  tone: IconTone;
}[] = [
  {
    value: 'new_grad',
    label: 'Student or new grad',
    short: 'New grad',
    min: 0,
    max: 0,
    Art: ProfileEducationIllustration,
    tone: 'brand',
  },
  {
    value: '1_2',
    label: '1–2 years',
    short: '1–2 yrs',
    min: 1,
    max: 2,
    Art: ProfileSkillsIllustration,
    tone: 'green',
  },
  {
    value: '3_5',
    label: '3–5 years',
    short: '3–5 yrs',
    min: 3,
    max: 5,
    Art: ProfileExperienceIllustration,
    tone: 'blue',
  },
  {
    value: '6_10',
    label: '6–10 years',
    short: '6–10 yrs',
    min: 6,
    max: 10,
    Art: ProfileInsightsIllustration,
    tone: 'brand',
  },
  {
    value: '10_plus',
    label: '10+ years',
    short: '10+ yrs',
    min: 11,
    max: Number.POSITIVE_INFINITY,
    Art: NavUpgradeIllustration,
    tone: 'amber',
  },
];

/** The band a profile's whole years fall in, when it has them. */
export function bandForYears(years: number | undefined): ExperienceBand | undefined {
  if (years == null) return undefined;
  return EXPERIENCE_BANDS.find((band) => years >= band.min && years <= band.max)?.value;
}

/** ONB 04's two choices (814:269, 814:298). */
export type ResumeChoice = 'upload' | 'build';

export const RESUME_CHOICES: readonly {
  value: ResumeChoice;
  label: string;
  hint: string;
  Art: Art;
}[] = [
  {
    value: 'upload',
    label: 'Yes, I’ll upload it',
    hint: 'PDF or DOCX. We’ll read it and fill your profile in seconds.',
    Art: JdArtUploadFileIllustration,
  },
  {
    value: 'build',
    label: 'No, help me make one',
    hint: 'Answer three quick questions and we’ll draft a starting point for you.',
    Art: AssistantTermsIllustration,
  },
];
