import type { Currency } from './types';

/**
 * The price book's rules (P12-08; spec §13.2, §13.4): the currency follows the billing country,
 * EUR and AUD prices include VAT and GST (consumer display), and amounts are minor units. The
 * prices themselves live in `plans.prices`, versioned (`plans.price_version`) and edited by admins.
 */

/** Countries that bill in EUR: the euro area (§13.2 prices Germany; the rest of the area follows). */
const EURO_AREA = new Set(['AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK']);

export function currencyFor(country: string | null | undefined): Currency {
  const c = (country ?? '').toUpperCase();
  if (c === 'AU') return 'AUD';
  if (EURO_AREA.has(c)) return 'EUR';
  return 'USD';
}

/** Tax-inclusive display in EUR and AUD markets (§13.4); US prices are shown before sales tax. */
export const TAX_INCLUSIVE: Record<Currency, boolean> = { USD: false, EUR: true, AUD: true };

export const toMajor = (minor: number) => minor / 100;
