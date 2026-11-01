import type { SheetOption } from '@/ui/OptionSheet';
import { formatWeekdayDate } from '@/lib';

export const NO_INTERVIEW_DAY = 'none';
/** Interviews are rarely booked further out than this, and the list has to stay short enough. */
const DAYS_AHEAD = 30;

/**
 * The next month, day by day. A day is kept at local noon, so it reads as the same day wherever the
 * phone is. The app has no date picker, and a list needs no new dependency (rule 1).
 */
export function interviewDayOptions(now: Date): SheetOption[] {
  const days = Array.from({ length: DAYS_AHEAD }, (_, offset) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12);
    const key = day.toISOString();
    return { key, label: formatWeekdayDate(key) };
  });
  return [{ key: NO_INTERVIEW_DAY, label: 'Not set' }, ...days];
}
