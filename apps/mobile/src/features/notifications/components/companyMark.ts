import type { ColorToken } from '@/theme';

export type CompanyMark = {
  bg: ColorToken;
  fg: ColorToken;
  /** Drawn in place of the initial — Slack's "#" (Figma 619:24). */
  glyph?: string;
};

/**
 * How the redesigned feed (Figma 619:2) draws each company it names as a letter tile. The board
 * gives Stripe its own violet, Linear ink, CRED the danger tint (a rejection), and Slack and
 * Notion white; any other company gets the grey tile Zoho wears (619:121).
 */
const MARKS: Record<string, CompanyMark> = {
  Stripe: { bg: 'companyStripe', fg: 'textOnBrand' },
  Slack: { bg: 'surfaceCard', fg: 'companySlack', glyph: '#' },
  Linear: { bg: 'surfaceInverse', fg: 'textOnDark' },
  Notion: { bg: 'surfaceCard', fg: 'textPrimary' },
  CRED: { bg: 'tileDanger', fg: 'glyphDanger' },
};

const FALLBACK: CompanyMark = { bg: 'surfaceSubtle', fg: 'textPrimary' };

export function companyMark(company: string): CompanyMark {
  return MARKS[company] ?? FALLBACK;
}
