import type { AdminDelta, AdminRange } from '@nextkin/shared/models';

/**
 * How the admin portal writes its numbers. Every figure keeps its unit beside it (G18): a rate
 * reads "58.2%", a change in a rate reads "3.2 pts", a change in a count reads "12.4%".
 */

const count = new Intl.NumberFormat('en-US');

export const formatCount = (n: number): string => count.format(n);

/** 1,500 → "1.5k", for an axis label. */
/**
 * An axis label in thousands once the axis reaches 1,000, every tick alike ("0.5k", "1k",
 * "1.5k", Figma 396:657); a smaller axis keeps plain counts.
 */
export const formatAxis = (n: number, top: number): string =>
  top >= 1000 && n > 0 ? `${Number((n / 1000).toFixed(1))}k` : String(n);

export const formatCompact = (n: number): string =>
  n >= 1000 ? `${Number((n / 1000).toFixed(1))}k` : String(n);

/** A fraction as a percentage: 0.582 → "58.2%". Whole percentages drop the decimal: 0.03 → "3%". */
export function formatRate(rate: number, digits = 1): string {
  const pct = Number((rate * 100).toFixed(digits));
  return `${pct}%`;
}

/** The size of a change, without its sign (the badge's arrow carries the direction). */
export function formatDelta(delta: AdminDelta): string {
  const size = Math.abs(delta.value);
  return delta.unit === 'points' ? `${size} pts` : `${size}%`;
}

/** Whole dollars with separators: 1284 → "$1,284". */
export const formatUsd = (usd: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(usd);

/** A small unit cost keeps three decimals: 0.061 → "$0.061". */
export const formatUnitUsd = (usd: number): string => `$${usd.toFixed(3)}`;

const SYMBOL: Record<string, string> = { USD: '$', EUR: '€', AUD: 'A$' };

/** Minor units in a currency, whole: 132000 EUR → "€1,320". */
export const formatMoney = (minor: number, currency: string): string =>
  `${SYMBOL[currency] ?? `${currency} `}${count.format(Math.round(minor / 100))}`;

export const RANGE_DAYS: Record<AdminRange, number> = { '7d': 7, '30d': 30, '90d': 90 };

/** A time of day, 24-hour, as the audit table prints it: "09:02". */
export const formatClock = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** "Sat, Nov 1" for the chart's tooltip; "Nov 1" for its axis. */
export const formatDay = (iso: string, withWeekday = false): string =>
  new Date(iso).toLocaleDateString('en-US', {
    ...(withWeekday ? { weekday: 'short' } : {}),
    month: 'short',
    day: 'numeric',
  });

/**
 * A target as the audit table shows it: a user or a technology by the last four characters of its
 * id ("user ···4f2a"), never the whole id; a prompt by its version.
 */
export function maskTarget(target: {
  kind: 'user' | 'technology' | 'prompt';
  ref: string;
}): string {
  if (target.kind === 'prompt') return `prompt ${target.ref}`;
  const prefix = target.kind === 'technology' ? 'tech' : 'user';
  return `${prefix} ···${target.ref.slice(-4)}`;
}

/** "Priya R." → "PR"; "Ehsan" → "EH". */
export function initialsOf(name: string): string {
  const words = name
    .replace(/[^\p{L}\s]/gu, '')
    .trim()
    .split(/\s+/);
  if (words.length >= 2) return `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}`.toUpperCase();
  return (words[0] ?? '').slice(0, 2).toUpperCase();
}
