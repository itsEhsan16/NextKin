import type { EmploymentType, SalaryRange } from '../models';

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
  /** One line on what the role was, as the web Profile board prints it under the dates (476:701). */
  summary?: string;
};

export type Education = {
  id: string;
  institution: string;
  degree: string;
  field?: string;
  /** ISO-8601 date (YYYY-MM-DD), or `''` when it isn't known (web onboarding asks only the year finished). */
  startDate: string;
  endDate?: string;
  /**
   * `'year'` when only the end's year is known (ONB 07's "Year finished", Figma 808:266): the
   * stored date is that year's last day, and nothing may print its month. Absent means a full date.
   */
  endPrecision?: 'year';
  current: boolean;
};

/** A credential row on the profile (V2 §10 profile aggregate; no artboard yet — plan phase 9F). */
export type Certification = {
  id: string;
  name: string;
  issuer: string;
  /** ISO date (YYYY-MM-DD). */
  issuedOn?: string;
  expiresOn?: string;
  credentialUrl?: string;
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

/** What the user is aiming for, from web onboarding's ONB 02 (Figma 807:53). */
export type CareerGoal = 'first_job' | 'better_role' | 'new_field' | 'exploring';

/**
 * Working years as the user gave them, a band rather than a count (ONB 03, Figma 807:136): kept
 * apart from `Profile.yearsExperience` so nothing claims a precision nobody gave.
 */
export type ExperienceBand = 'new_grad' | '1_2' | '3_5' | '6_10' | '10_plus';

export type ProfilePreferences = {
  availability: Availability;
  minSalary?: SalaryRange;
  locations: string[];
  remote: RemotePreference;
  language: Language;
  /** Job titles the matcher targets, capped at MAX_DESIRED_ROLES. */
  desiredRoles: string[];
  /** The kinds of job wanted: the web Account board's "Full-time" (Figma 307:3650). */
  employmentTypes?: EmploymentType[];
  /** "Industries of interest" on the web Settings → Preferences board (Figma 356:61). */
  industries?: string[];
  /** Web onboarding's goal (ONB 02). */
  careerGoal?: CareerGoal;
  /** Web onboarding's experience band (ONB 03). */
  experienceBand?: ExperienceBand;
};

/** What a link points at — picks the row glyph and the picker option (plan phase 9F). */
export type LinkKind = 'portfolio' | 'linkedin' | 'github' | 'website' | 'other';

export const LINK_KIND_LABEL: Record<LinkKind, string> = {
  portfolio: 'Portfolio',
  linkedin: 'LinkedIn',
  github: 'GitHub',
  website: 'Website',
  other: 'Other',
};

export type ProfileLink = {
  id: string;
  label: string;
  url: string;
  kind?: LinkKind;
};

/**
 * The three counters on the profile stats card (Figma 1:2208). Each is absent, not zero, when
 * there is nothing to count it from (C-11): applications and interviews belong to the Release 2
 * tracker, and the average needs at least one resume scored against a JD.
 */
/**
 * A role's skill tag that does not fit the role's dates, or that the knowledge base cannot check
 * (P9-05, V2 §7.3). A warning only: the profile still saves.
 */
export type SkillWarning = {
  experienceId: string;
  skill: string;
  verdict: 'invalid' | 'suspect' | 'unverified';
  message: string;
};

export type ProfileStats = {
  applications?: number;
  interviews?: number;
  avgAtsScore?: number;
};

export type Profile = {
  userId: string;
  headline?: string;
  location?: string;
  yearsExperience?: number;
  /** A contact number, as the web Account board prints it (Figma 307:3545). */
  phone?: string;
  /** "About me" (Figma 307:3582): a few lines in the candidate's own words. */
  bio?: string;
  /** The one-line motto beside the web profile card (Figma 307:3563). */
  tagline?: string;
  /**
   * Whether the LinkedIn integration is connected. Listing a LinkedIn URL in `links` is not the
   * same thing, which is how the web board can show the URL and still say "Link your LinkedIn".
   */
  linkedinConnected?: boolean;
  skills: string[];
  experiences: Experience[];
  education: Education[];
  certifications: Certification[];
  links: ProfileLink[];
  stats: ProfileStats;
  /** 0–1 */
  completeness: number;
  /** Skills tagged outside their role's era (P9-05). Absent when every tag fits. */
  skillWarnings?: SkillWarning[];
  nextSteps: NextStep[];
  preferences: ProfilePreferences;
};

/** The identity fields the "Edit profile" form writes back (plan phase 9F). */
export type ProfilePatch = Partial<Pick<Profile, 'headline' | 'location' | 'yearsExperience'>>;

/**
 * What parsing an uploaded resume yields. Nothing is committed until the user accepts the rows
 * (V2 §7.4: abandoning the review leaves the profile byte-for-byte unchanged).
 */
export type ProfileDraft = {
  headline?: string;
  skills?: string[];
  experiences?: Experience[];
  education?: Education[];
  certifications?: Certification[];
};
