/**
 * Navigation targets that designed screens link to but that have no artboard yet.
 * Each becomes `/placeholder/<key>` until its own screen lands (see plan §8).
 */
export type PlaceholderKey =
  | 'notifications'
  | 'menu'
  | 'build-resume'
  | 'zero-resume'
  | 'cover-letter'
  | 'ats-check'
  | 'history'
  | 'interview-prep'
  | 'ai-assistant'
  | 'job-detail'
  | 'resume-detail';

export type PlaceholderMeta = {
  title: string;
  /** Build phase in which the real screen lands; omitted when nothing is designed yet. */
  phase?: number;
  figmaScreens: readonly string[];
};

export const PLACEHOLDERS: Record<PlaceholderKey, PlaceholderMeta> = {
  notifications: {
    title: 'Notifications',
    phase: 6,
    figmaScreens: ['NOTIF 01 — Feed', 'NOTIF 02 — Swipe actions', 'NOTIF 03 — Row menu'],
  },
  menu: { title: 'Menu', phase: 5, figmaScreens: ['PROFILE 02 — Settings & account'] },
  'build-resume': { title: 'Build Resume', phase: 2, figmaScreens: ['CREATE 02 — New Resume'] },
  'zero-resume': { title: 'Zero Resume', phase: 2, figmaScreens: ['CREATE 02 — New Resume'] },
  'cover-letter': { title: 'Cover Letter', phase: 2, figmaScreens: ['CREATE 01 — + sheet'] },
  'ats-check': { title: 'ATS Check', phase: 4, figmaScreens: ['RESUMES 04 — Score panel'] },
  history: { title: 'History', figmaScreens: [] },
  'interview-prep': { title: 'Interview Prep', figmaScreens: [] },
  'ai-assistant': { title: 'AI Assistant', figmaScreens: [] },
  'job-detail': { title: 'Job Detail', phase: 3, figmaScreens: ['JOBS 05 — Job Detail'] },
  'resume-detail': { title: 'Resume', phase: 4, figmaScreens: ['RESUMES 04 — Score panel'] },
};

export const isPlaceholderKey = (value: string): value is PlaceholderKey => value in PLACEHOLDERS;
