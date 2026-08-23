import type { SalaryRange } from '@/lib';

/** NextKin V2 spec §10 — Profile aggregate (candidate app). */

export type Experience = {
  id: string;
  company: string;
  title: string;
  /** ISO-8601 date (YYYY-MM-DD) */
  startDate: string;
  /** ISO-8601 date; absent while `current` */
  endDate?: string;
  current: boolean;
  skills: string[];
};

export type Education = {
  id: string;
  institution: string;
  degree: string;
  field?: string;
  /** ISO-8601 date (YYYY-MM-DD) */
  startDate: string;
  endDate?: string;
  current: boolean;
};

/** Suggested action shown on the profile completeness card. */
export type NextStep = {
  id: string;
  label: string;
  /** Ionicons glyph name (rendered via @expo/vector-icons). */
  icon: string;
};

export type Availability = 'immediately' | '2_weeks' | '1_month' | 'not_looking';

export type RemotePreference = 'remote' | 'hybrid' | 'onsite' | 'any';

export type Language = 'en' | 'de';

export type ProfilePreferences = {
  availability: Availability;
  minSalary?: SalaryRange;
  locations: string[];
  remote: RemotePreference;
  language: Language;
};

export type Profile = {
  userId: string;
  headline?: string;
  location?: string;
  yearsExperience?: number;
  skills: string[];
  experiences: Experience[];
  education: Education[];
  /** 0–1 */
  completeness: number;
  nextSteps: NextStep[];
  preferences: ProfilePreferences;
};
