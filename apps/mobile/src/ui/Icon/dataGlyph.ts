import type { LineIconName } from './Icon';

/**
 * Glyph names the shared data layer carries (a notification's tile, a profile next step). They
 * are FontAwesome 5 names, the vocabulary the API was specified in, so the contract stays as it is
 * and the phone translates at the edge. An unknown name draws the neutral info glyph rather than
 * nothing.
 */
const DATA_GLYPH: Record<string, LineIconName> = {
  'chart-bar': 'BarChart07',
  clock: 'Clock',
  'credit-card': 'CreditCard01',
  envelope: 'Mail01',
  'file-alt': 'File06',
  plus: 'Plus',
  bell: 'Bell01',
  briefcase: 'Briefcase01',
  check: 'Check',
  'check-circle': 'CheckCircle',
  star: 'Star01',
};

export const dataGlyph = (name: string): LineIconName => DATA_GLYPH[name] ?? 'InfoCircle';
