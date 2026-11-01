/**
 * Clock arithmetic for a push. A nudge lands at 9am on the phone's clock, and quiet hours hold
 * anything else until 8am. Across a clock change the wait can be an hour out, which a nudge can bear.
 */

export const QUIET_FROM_HOUR = 22;
export const QUIET_TO_HOUR = 8;
export const NUDGE_HOUR = 9;

const DAY_MINUTES = 24 * 60;

function localClock(now: Date, zone: string): { hour: number; minute: number } {
  const read = (timeZone: string) => {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    return { hour: part('hour'), minute: part('minute') };
  };
  try {
    return read(zone);
  } catch {
    return read('UTC');
  }
}

export const isValidTimeZone = (zone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};

export function inQuietHours(now: Date, zone: string): boolean {
  const { hour } = localClock(now, zone);
  return hour >= QUIET_FROM_HOUR || hour < QUIET_TO_HOUR;
}

/** The next time the phone's clock reads `hour` o'clock: `now` itself if it reads that already. */
export function nextLocalHour(now: Date, zone: string, hour: number): Date {
  const clock = localClock(now, zone);
  const wait = ((hour - clock.hour) * 60 - clock.minute + DAY_MINUTES) % DAY_MINUTES;
  // On the minute, so two nudges for one morning tie, and `rank` decides between them.
  return new Date((Math.floor(now.getTime() / 60_000) + wait) * 60_000);
}
