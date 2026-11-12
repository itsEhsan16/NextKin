import type { AccountSession, ConnectedProvider, ProfileVisibility } from '@nextkin/shared/models';

import { formatCoarseAge } from '@/lib/format';

/**
 * How the Settings board (Figma 254:326) reads the account. See `toreview.md` §21.
 */

/**
 * The board's eight sections (254:1009) in its order, each one's name and the line under it
 * verbatim. Account, Preferences and Notifications are drawn; Privacy & data and Connected
 * accounts are built from mockups (`toreview.md` §30).
 */
export const SETTINGS_SECTIONS = {
  account: { label: 'Account', description: 'Email, phone, basic info' },
  preferences: { label: 'Preferences', description: 'App settings and language' },
  notifications: { label: 'Notifications', description: 'Manage what you receive' },
  privacy: { label: 'Privacy & data', description: 'Control your data' },
  connected: { label: 'Connected accounts', description: 'Google sign-in' },
  billing: { label: 'Billing & plan', description: 'Manage subscription' },
  security: { label: 'Security', description: 'Two-factor auth, sessions' },
  delete: { label: 'Delete account', description: 'Permanently delete your account' },
} as const satisfies Record<string, { label: string; description: string }>;

export type SettingsSection = keyof typeof SETTINGS_SECTIONS;

/** The ids in the board's order, for the list down the left. */
export const SETTINGS_SECTION_ORDER = Object.keys(SETTINGS_SECTIONS) as SettingsSection[];

export const isSettingsSection = (value: string): value is SettingsSection =>
  Object.hasOwn(SETTINGS_SECTIONS, value);

/**
 * What the header says for a section. The drawn boards title the page after their section
 * (254:606 "Account settings", 356:313 "Preferences", 247:1218 "Notifications"), and so do the
 * Privacy & data and Connected accounts mockups, so an undrawn one is named by its row, with the
 * row's line under it (`toreview.md` §22).
 */
export function sectionHeading(section: SettingsSection): { title: string; subtitle: string } {
  switch (section) {
    case 'notifications':
      return {
        title: 'Notifications',
        subtitle: 'Manage what you receive and stay updated on what matters most.',
      };
    case 'account':
      return {
        title: 'Account settings',
        subtitle:
          'Manage your account, security, and preferences to keep your NextKin experience safe and personalized.',
      };
    case 'preferences':
      return {
        title: 'Preferences',
        subtitle: 'Customize your NextKin experience to match your goals, workflow, and style.',
      };
    case 'privacy':
      return {
        title: 'Privacy & data',
        subtitle: 'Control your personal information, data usage, and privacy preferences.',
      };
    case 'security':
      return {
        title: 'Security',
        subtitle: "Manage your password, two-factor sign-in, and where you're signed in.",
      };
    case 'billing':
      return {
        title: 'Billing & plan',
        subtitle: 'Manage your subscription, billing details, and payment methods.',
      };
    case 'delete':
      return {
        title: 'Delete account',
        subtitle: "We're sorry to see you go. Please read the information below carefully.",
      };
    case 'connected':
      return {
        title: 'Connected accounts',
        subtitle:
          'Connect your accounts to import data, automate your profile, and get a better experience.',
      };
    default: {
      const { label, description } = SETTINGS_SECTIONS[section];
      return { title: label, subtitle: description };
    }
  }
}

/**
 * "Profile visibility" (Privacy & data mockup). The mockup shows "Visible to recruiters" and names
 * the other two in the row's line: "recruiters, public, or private".
 */
export const PROFILE_VISIBILITY_OPTIONS: readonly ProfileVisibility[] = [
  'recruiters',
  'public',
  'private',
];

export const PROFILE_VISIBILITY_LABEL: Record<ProfileVisibility, string> = {
  recruiters: 'Visible to recruiters',
  public: 'Public',
  private: 'Private',
};

/** Connected accounts' rows: each provider's name and the mockup's line under it. */
export const CONNECTED_PROVIDER: Record<ConnectedProvider, { name: string; line: string }> = {
  google: { name: 'Google', line: 'Use Google to sign in and sync your data.' },
};

/** "Mac • Chrome" (254:572). */
export const sessionName = (session: AccountSession): string =>
  `${session.platform} • ${session.browser}`;

/** "Current session", or when a device was last used: "Last active 3 days ago" (254:577, 587). */
export function sessionActivity(session: AccountSession, now: Date = new Date()): string {
  if (session.current) return 'Current session';
  const age = formatCoarseAge(session.lastActiveAt, now);
  return `Last active ${age === 'Today' ? 'today' : age}`;
}
