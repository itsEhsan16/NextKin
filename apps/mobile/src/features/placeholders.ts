/**
 * Navigation targets that designed screens link to but that have no artboard yet.
 * Each becomes `/placeholder/<key>` until its own screen lands (see plan §8).
 */
export type PlaceholderKey =
  | 'menu'
  | 'history'
  | 'interview-prep'
  | 'ai-assistant'
  | 'job-sort'
  | 'job-location'
  | 'job-share'
  | 'company-profile'
  | 'match-criteria'
  | 'resume-sort'
  | 'help'
  | 'contact'
  | 'rate'
  | 'terms'
  | 'privacy'
  | 'account-email'
  | 'account-export';

export type PlaceholderMeta = {
  title: string;
  /** Build phase in which the real screen lands; omitted when nothing is designed yet. */
  phase?: number;
  figmaScreens: readonly string[];
};

export const PLACEHOLDERS: Record<PlaceholderKey, PlaceholderMeta> = {
  menu: { title: 'Menu', figmaScreens: [] },
  history: { title: 'History', figmaScreens: [] },
  'interview-prep': { title: 'Interview Prep', figmaScreens: [] },
  'ai-assistant': { title: 'AI Assistant', figmaScreens: [] },
  'job-sort': { title: 'Sort jobs', figmaScreens: [] },
  'job-location': { title: 'Location', figmaScreens: [] },
  // Linked from JOBS 05 but never drawn: the share sheet, the company profile and the full
  // match breakdown. (Apply became real in Phase 6 — NOTIF 07's post-apply flow.)
  'job-share': { title: 'Share job', figmaScreens: [] },
  'company-profile': { title: 'Company', figmaScreens: [] },
  'match-criteria': { title: 'Full criteria', figmaScreens: [] },
  // The library's sort control. Not in any phase table of the plan — it belongs with the jobs
  // sort sheet in 9H, which is the same OptionSheet-over-the-tab-bar shape.
  'resume-sort': { title: 'Sort documents', figmaScreens: [] },
  help: { title: 'Help & FAQ', figmaScreens: [] },
  contact: { title: 'Contact us', figmaScreens: [] },
  rate: { title: 'Rate NextKin', figmaScreens: [] },
  terms: { title: 'Terms of service', figmaScreens: [] },
  privacy: { title: 'Privacy policy', figmaScreens: [] },
  'account-email': { title: 'Email & password', figmaScreens: [] },
  'account-export': { title: 'Export my data', figmaScreens: [] },
};

export const isPlaceholderKey = (value: string): value is PlaceholderKey => value in PLACEHOLDERS;
