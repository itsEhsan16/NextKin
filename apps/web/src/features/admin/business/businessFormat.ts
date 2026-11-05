import type { BusinessCurrency } from '@nextkin/shared/models';

/**
 * How the Business pages write money and dates. Prices are stored in minor units (1900 = $19.00)
 * and shown with their currency's mark (Figma 406:2873): "$19.00" in the price book, "$19" on a
 * plan card.
 */

const SYMBOL: Record<BusinessCurrency, string> = { USD: '$', EUR: '€', AUD: 'A$' };

export function formatPrice(minor: number, currency: BusinessCurrency, cents = false): string {
  const value = minor / 100;
  const digits = cents ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : {};
  const text = value.toLocaleString('en-US', cents ? digits : { maximumFractionDigits: 2 });
  return `${SYMBOL[currency]}${text}`;
}

/** Dollars, with cents: 526.4 → "$526.40"; a per-call figure keeps three places. */
export function formatDollars(usd: number, places = 2): string {
  return `$${usd.toLocaleString('en-US', { minimumFractionDigits: places, maximumFractionDigits: places })}`;
}

/** "Oct 1, 2026". */
export function formatDate(iso: string): string {
  const date = iso.length === 10 ? new Date(`${iso}T00:00:00Z`) : new Date(iso);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "Sep 2", for a "last changed" line in the current year. */
export function formatShortDate(iso: string): string {
  const date = iso.length === 10 ? new Date(`${iso}T00:00:00Z`) : new Date(iso);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** 41.2 million → "41.2M"; 980 thousand → "980K". */
export function formatTokens(tokens: number): string {
  if (tokens >= 1e6) return `${Number((tokens / 1e6).toFixed(1))}M`;
  if (tokens >= 1e3) return `${Number((tokens / 1e3).toFixed(1))}K`;
  return String(tokens);
}

/**
 * Parses a typed price ("19", "19.5", "$19.00", "€19") into minor units; `null` if it isn't a
 * price. Only a dot marks the decimals: "19,50" is refused rather than read as 1,950.
 */
export function parsePrice(text: string): number | null {
  const cleaned = text.trim().replace(/^(A\$|\$|€)\s*/, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}
