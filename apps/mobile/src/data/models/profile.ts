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
  /** FontAwesome 5 Free Solid glyph name (the artboard chips all lead with a plus, 1:2224). */
  icon: string;
};

export type Availability = 'immediately' | '2_weeks' | '1_month' | 'open_to_offers' | 'not_looking';

/** Availability row value and the identity pill (Figma 1:2205 / 1:2282). */
export const AVAILABILITY_LABEL: Record<Availability, string> = {
  immediately: 'Available now',
  '2_weeks': '2 weeks notice',
  '1_month': '1 month notice',
  open_to_offers: 'Open to offers',
  not_looking: 'Not looking',
};

export type RemotePreference = 'remote' | 'hybrid' | 'onsite' | 'any';

/** Second half of the "Locations & remote" row value ("Bengaluru · Remote", 1:2272). */
export const REMOTE_PREFERENCE_LABEL: Record<RemotePreference, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
  any: 'Flexible',
};

export type Language = 'en' | 'de';

export const LANGUAGE_LABEL: Record<Language, string> = {
  en: 'English',
  de: 'German',
};

/** The "Desired roles" row reads "3 of 5" against this cap (Figma 1:2267). */
export const MAX_DESIRED_ROLES = 5;

export type ProfilePreferences = {
  availability: Availability;
  minSalary?: SalaryRange;
  locations: string[];
  remote: RemotePreference;
  language: Language;
  /** Job titles the matcher targets, capped at MAX_DESIRED_ROLES. */
  desiredRoles: string[];
};

export type ProfileLink = {
  id: string;
  label: string;
  url: string;
};

/** The three counters on the profile stats card (Figma 1:2208). */
export type ProfileStats = {
  applications: number;
  interviews: number;
  avgAtsScore: number;
};

export type Profile = {
  userId: string;
  headline?: string;
  location?: string;
  yearsExperience?: number;
  skills: string[];
  experiences: Experience[];
  education: Education[];
  certifications: string[];
  links: ProfileLink[];
  stats: ProfileStats;
  /** 0–1 */
  completeness: number;
  nextSteps: NextStep[];
  preferences: ProfilePreferences;
};
