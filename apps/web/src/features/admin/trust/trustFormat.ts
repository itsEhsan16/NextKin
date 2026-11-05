/**
 * How the Trust & safety boards write times and references (Figma 406:1195, 407:946, 408:1531).
 * A reference shows only its last four characters ("run ···c51a"); an IP address keeps its first
 * two parts and its last ("102.89.···.14").
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "run ···c51a", "user ···9c10". */
export const masked = (prefix: string, id: string) => `${prefix} ···${id.slice(-4)}`;

/** "12 min ago", "1 h ago", "3 d ago" (Figma 406:1465). */
export function ageOf(iso: string, now = Date.now()): string {
  const ms = Math.max(0, now - new Date(iso).getTime());
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / MINUTE))} min ago`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)} h ago`;
  return `${Math.floor(ms / DAY)} d ago`;
}

/** "102.89.···.14": the network and the host's last part, never the whole address. */
export function maskIp(ip: string): string {
  const parts = ip.split('.');
  if (parts.length !== 4) return ip ? '···' : '—';
  return `${parts[0]}.${parts[1]}.···.${parts[3]}`;
}

/** "Nov 5 · 06:12", in the viewer's time (Figma 407:1192). */
export function formatReceived(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}

/** "Nov 5, 2026" and "10:42:18", in UTC, as the audit log's Time (UTC) column (Figma 408:1760). */
export function utcParts(iso: string): { date: string; time: string } {
  const date = new Date(iso);
  return {
    date: date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }),
    time: date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'UTC',
    }),
  };
}

/** "Nov 5, 2026 · 09:41:07", in the viewer's time (the run drawer, Figma 406:1795). */
export function formatStamp(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return `${day} · ${time}`;
}

/** "3 min 12 s". */
export function formatSpan(fromIso: string, toIso: string): string {
  const seconds = Math.max(
    0,
    Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 1000),
  );
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes} min ${seconds % 60} s` : `${seconds} s`;
}

/** "Oct 28". */
export const formatShortDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** "Oct 6 – Nov 5, 2026": the audit log's date range (Figma 408:1704). */
export function formatRange(days: number | null, now = Date.now()): string {
  const end = new Date(now);
  const year = end.getFullYear();
  const short = (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (days === null) return `All time – ${short(end)}, ${year}`;
  const start = new Date(now - days * DAY);
  return `${short(start)} – ${short(end)}, ${year}`;
}

/** Hands the browser a CSV it has the text of. */
export function downloadText(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
