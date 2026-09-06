/**
 * Navigation targets that designed screens link to but that have no artboard yet.
 * Each becomes `/placeholder/<key>` until its own screen lands (see plan §8).
 */
export type PlaceholderKey =
  | 'menu'
  | 'history'
  | 'interview-prep'
  | 'ai-assistant'
  | 'resume-sort';

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
  // The library's sort control. In no phase table of the plan — it is the same
  // OptionSheet-over-the-tab-bar shape as the jobs sort sheet, and is logged in `toreview.md`
  // waiting on a decision rather than built on a guess.
  'resume-sort': { title: 'Sort documents', figmaScreens: [] },
};

export const isPlaceholderKey = (value: string): value is PlaceholderKey => value in PLACEHOLDERS;
