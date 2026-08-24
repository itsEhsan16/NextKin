/**
 * Navigation targets that designed screens link to but that have no artboard yet.
 * Each becomes `/placeholder/<key>` until its own screen lands (see plan §8).
 */
export type PlaceholderKey =
  | 'menu'
  | 'build-resume'
  | 'zero-resume'
  | 'cover-letter'
  | 'ats-check'
  | 'tailor-to-a-job'
  | 'upload-resume'
  | 'import-linkedin'
  | 'start-from-scratch'
  | 'history'
  | 'interview-prep'
  | 'ai-assistant'
  | 'job-sort'
  | 'job-location'
  | 'job-share'
  | 'company-profile'
  | 'match-criteria'
  | 'resume-detail'
  | 'resume-sort'
  | 'resume-rename'
  | 'resume-download'
  | 'resume-share'
  | 'ats-fix'
  | 'upgrade'
  | 'profile-edit'
  | 'profile-experience'
  | 'profile-education'
  | 'profile-skills'
  | 'profile-certifications'
  | 'profile-links'
  | 'desired-roles'
  | 'profile-locations'
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
  'build-resume': { title: 'Build Resume', figmaScreens: [] },
  'zero-resume': { title: 'Zero Resume', figmaScreens: [] },
  'cover-letter': { title: 'Cover Letter', figmaScreens: [] },
  // The score PANEL shipped in Phase 4 (`/resumes/[id]/score`); what this entry point still
  // needs is the undesigned pick-a-resume / upload step in front of it.
  'ats-check': { title: 'ATS Check', figmaScreens: [] },
  'tailor-to-a-job': { title: 'Tailor to a Job', figmaScreens: [] },
  'upload-resume': { title: 'Upload resume', figmaScreens: [] },
  // V2 §6.2 lists LinkedIn import as out of scope (no stable public API); the row exists
  // because CREATE 02 designs it, but it has nowhere to go yet.
  'import-linkedin': { title: 'Import from LinkedIn', figmaScreens: [] },
  'start-from-scratch': { title: 'Start from scratch', figmaScreens: [] },
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
  // The score panel shipped in Phase 4; what remains behind this key is the undesigned editor.
  'resume-detail': { title: 'Resume', figmaScreens: [] },
  'resume-sort': { title: 'Sort documents', figmaScreens: [] },
  'resume-rename': { title: 'Rename', figmaScreens: [] },
  // V2 §7.12 exports and share links have no artboard yet; the menu rows need somewhere to go.
  'resume-download': { title: 'Download', figmaScreens: [] },
  'resume-share': { title: 'Share link', figmaScreens: [] },
  'ats-fix': { title: 'Fix with AI', figmaScreens: [] },
  upgrade: { title: 'Upgrade', figmaScreens: [] },
  // Profile edit flows (V2 §7.3) are undesigned; every PROFILE 01 row links out to one.
  'profile-edit': { title: 'Edit profile', figmaScreens: [] },
  'profile-experience': { title: 'Work experience', figmaScreens: [] },
  'profile-education': { title: 'Education', figmaScreens: [] },
  'profile-skills': { title: 'Skills', figmaScreens: [] },
  'profile-certifications': { title: 'Certifications', figmaScreens: [] },
  'profile-links': { title: 'Links', figmaScreens: [] },
  'desired-roles': { title: 'Desired roles', figmaScreens: [] },
  'profile-locations': { title: 'Locations & remote', figmaScreens: [] },
  help: { title: 'Help & FAQ', figmaScreens: [] },
  contact: { title: 'Contact us', figmaScreens: [] },
  rate: { title: 'Rate NextKin', figmaScreens: [] },
  terms: { title: 'Terms of service', figmaScreens: [] },
  privacy: { title: 'Privacy policy', figmaScreens: [] },
  'account-email': { title: 'Email & password', figmaScreens: [] },
  'account-export': { title: 'Export my data', figmaScreens: [] },
};

export const isPlaceholderKey = (value: string): value is PlaceholderKey => value in PLACEHOLDERS;
