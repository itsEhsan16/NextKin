const DAY = 24 * 60 * 60 * 1000;

/**
 * The date filter both lists offer: "Time period" over the applications (286:1283), "Last
 * updated" over the resumes (304:3111). Neither board draws the menu open, so the windows are ours.
 */
export type TimeWindow = '7d' | '30d' | '90d';

export const TIME_WINDOW_LABEL: Record<TimeWindow, string> = {
  '7d': 'Past week',
  '30d': 'Past month',
  '90d': 'Past 3 months',
};

const TIME_WINDOW_DAYS: Record<TimeWindow, number> = { '7d': 7, '30d': 30, '90d': 90 };

export const isWithin = (iso: string, window: TimeWindow, now = Date.now()): boolean =>
  now - new Date(iso).getTime() <= TIME_WINDOW_DAYS[window] * DAY;
