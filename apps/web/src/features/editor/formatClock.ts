/**
 * When something was saved, as the reader's own clock shows it (redesign R6c, audit ED-14): "just
 * now" inside a minute, else the locale's short time ("14:05", "2:05 PM"). The save pill and the
 * restore banner both used a hand-rolled 24-hour "HH:MM".
 */
export function formatClock(at: Date, now: Date = new Date()): string {
  if (now.getTime() - at.getTime() < 60_000) return 'just now';
  return new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(at);
}
