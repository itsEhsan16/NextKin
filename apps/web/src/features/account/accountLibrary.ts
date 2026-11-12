import type { Availability, Profile, User } from '@nextkin/shared/models';
import { EMPLOYMENT_TYPE_LABEL, REMOTE_PREFERENCE_LABEL } from '@nextkin/shared/models';

/**
 * How the Account board (307:3443) read the account, kept for the Profile page that replaced it
 * (476:4) and for Settings, which took the plan card. See `toreview.md` §20, §91.
 */

/** The pill under the name (307:3534). The board says "Open to opportunities"; mobile, "Open to offers". */
export const AVAILABILITY_PILL: Record<Availability, string> = {
  immediately: 'Available now',
  '2_weeks': 'Available in 2 weeks',
  '1_month': 'Available in a month',
  open_to_offers: 'Open to opportunities',
  not_looking: 'Not looking right now',
};

/** "3–5 years" (307:3614): the years as a band, the way the board states them. */
export function experienceBand(years: number | undefined): string {
  if (years == null) return 'Not specified';
  if (years < 1) return 'Less than a year';
  if (years < 3) return '1–2 years';
  if (years < 6) return '3–5 years';
  if (years < 10) return '6–9 years';
  return '10+ years';
}

/** "B.Tech in Design" (307:3623): the latest qualification. */
export function educationLabel(profile: Profile): string | undefined {
  const latest = profile.education[0];
  if (!latest) return undefined;
  return latest.field ? `${latest.degree} in ${latest.field}` : latest.degree;
}

/** The employer of the current role; the board's "Not specified" (307:3632) when there is none. */
export const currentCompany = (profile: Profile): string | undefined =>
  profile.experiences.find((role) => role.current)?.company;

/** "Full-time, Hybrid" (307:3650): the kinds of job wanted, then where. */
export function preferredJobType(profile: Profile): string {
  const { employmentTypes = [], remote } = profile.preferences;
  return [
    ...employmentTypes.map((type) => EMPLOYMENT_TYPE_LABEL[type]),
    REMOTE_PREFERENCE_LABEL[remote],
  ].join(', ');
}

/** A URL as the board prints it (307:3555): no scheme, no trailing slash. */
export const displayUrl = (url: string): string =>
  url.replace(/^https?:\/\//, '').replace(/\/$/, '');

export type CompletionItem = { label: string; done: boolean };

/**
 * The checklist (307:3703), each item read off the account rather than copied from the board. The
 * board leaves "Upload a profile photo" unticked beside George's photo; here it is ticked. "Link
 * your LinkedIn" means the integration, which isn't connected, so it stays unticked as drawn.
 */
export function completionItems(user: User, profile: Profile): CompletionItem[] {
  return [
    {
      label: 'Basic information',
      done: Boolean(user.firstName && user.lastName && profile.headline),
    },
    { label: 'Contact details', done: Boolean(user.email && profile.phone) },
    { label: 'Location', done: Boolean(profile.location) },
    { label: 'Add a bio', done: Boolean(profile.bio) },
    { label: 'Add work experience', done: profile.experiences.length > 0 },
    {
      label: 'Add your LinkedIn',
      done:
        Boolean(profile.linkedinConnected) ||
        profile.links.some((link) => link.kind === 'linkedin'),
    },
    { label: 'Upload a profile photo', done: Boolean(user.avatarUrl) },
  ];
}

/**
 * The plan card's perks (307:3852), as drawn except the last: the board lists "Unlimited
 * downloads" as a paid perk, but a clean PDF is unlimited on every plan (V2 §7.12, §13.3), so it
 * names DOCX, the one format the free plan leaves out.
 */
export const PLAN_PERKS: readonly { label: string; free: boolean }[] = [
  { label: 'AI resume generation', free: true },
  { label: 'Basic job insights', free: true },
  { label: 'Limited document storage', free: true },
  { label: 'Priority processing', free: false },
  { label: 'Advanced AI suggestions', free: false },
  { label: 'Unlimited DOCX downloads', free: false },
];
