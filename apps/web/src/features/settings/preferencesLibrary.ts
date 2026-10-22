import type {
  DateFormat,
  EmploymentType,
  Language,
  RemotePreference,
  SalaryCurrency,
} from '@nextkin/shared/models';

/**
 * What the Settings → Preferences board (Figma 356:2) offers, and how it reads and writes the
 * values. See `toreview.md` §22.
 */

/** The board's four job types (356:26-38). The model's fifth, freelance, isn't drawn. */
export const JOB_TYPE_OPTIONS: readonly EmploymentType[] = [
  'full_time',
  'part_time',
  'contract',
  'internship',
];

/** The work modes: the board shows "Hybrid" (356:43), and the model has three more. */
export const WORK_MODE_OPTIONS: readonly RemotePreference[] = ['remote', 'hybrid', 'onsite', 'any'];

/**
 * What the location and industry menus offer. Neither the board nor the spec lists them, so these
 * are ours (`toreview.md` §22): the fixtures' Indian cities, a city for each launch market
 * (V2 §8.5), and broad industries. `withChosen` adds anything the account holds that they lack.
 */
export const LOCATION_OPTIONS: readonly string[] = [
  'Bengaluru, India',
  'Hyderabad, India',
  'Mumbai, India',
  'Pune, India',
  'Chennai, India',
  'Delhi NCR, India',
  'Remote',
  'New York, USA',
  'San Francisco, USA',
  'Berlin, Germany',
  'Sydney, Australia',
];

export const INDUSTRY_OPTIONS: readonly string[] = [
  'Technology',
  'Product',
  'Design',
  'Finance',
  'Healthcare',
  'Education',
  'E-commerce',
  'Media',
  'Consulting',
];

/** The list, then whatever is already chosen that the list lacks. */
export const withChosen = (options: readonly string[], chosen: readonly string[]): string[] => [
  ...options,
  ...chosen.filter((value) => !options.includes(value)),
];

/** "INR (₹)" (356:77), then the currencies the spec prices in (V2 §13.2). */
export const CURRENCY_OPTIONS: readonly SalaryCurrency[] = ['INR', 'USD', 'EUR', 'AUD'];

export const CURRENCY_LABEL: Record<SalaryCurrency, string> = {
  INR: 'INR (₹)',
  USD: 'USD ($)',
  EUR: 'EUR (€)',
  AUD: 'AUD (A$)',
};

/** "12,00,000" (356:81): rupees grouped in lakhs, the others in thousands. */
export function formatAmount(amount: number, currency: SalaryCurrency): string {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(amount);
}

/** The digits typed, as a whole number; nothing typed means no minimum. */
export function parseAmount(text: string): number | undefined {
  const digits = text.replace(/\D/g, '');
  return digits ? Number(digits) : undefined;
}

/**
 * "English (US)" (356:129). The profile holds a language, not a region, and the UI ships in
 * English (V2 §8.8), so German is stored when picked but translates nothing yet.
 */
export const LANGUAGE_OPTIONS: readonly Language[] = ['en', 'de'];

export const LANGUAGE_OPTION_LABEL: Record<Language, string> = {
  en: 'English (US)',
  de: 'Deutsch',
};

/** "DD MMM YYYY (e.g., 14 Jan 2024)" (356:136), and the four other common orders. */
export const DATE_FORMAT_OPTIONS: readonly DateFormat[] = [
  'd_mmm_y',
  'mmm_d_y',
  'dd_mm_y',
  'mm_dd_y',
  'y_mm_dd',
];

export const DATE_FORMAT_LABEL: Record<DateFormat, string> = {
  d_mmm_y: 'DD MMM YYYY (e.g., 14 Jan 2024)',
  mmm_d_y: 'MMM DD, YYYY (e.g., Jan 14, 2024)',
  dd_mm_y: 'DD/MM/YYYY (e.g., 14/01/2024)',
  mm_dd_y: 'MM/DD/YYYY (e.g., 01/14/2024)',
  y_mm_dd: 'YYYY-MM-DD (e.g., 2024-01-14)',
};

/**
 * "(GMT+05:30) India Standard Time - Bengaluru" (356:143), and a zone for each launch market
 * (V2 §8.5). The offsets are standard time, as most pickers print them.
 */
const TIME_ZONES: readonly { id: string; label: string }[] = [
  { id: 'Asia/Kolkata', label: '(GMT+05:30) India Standard Time - Bengaluru' },
  { id: 'America/New_York', label: '(GMT-05:00) Eastern Time - New York' },
  { id: 'America/Los_Angeles', label: '(GMT-08:00) Pacific Time - Los Angeles' },
  { id: 'Europe/Berlin', label: '(GMT+01:00) Central European Time - Berlin' },
  { id: 'Australia/Sydney', label: '(GMT+10:00) Australian Eastern Time - Sydney' },
  { id: 'UTC', label: '(GMT+00:00) Coordinated Universal Time' },
];

export const TIME_ZONE_OPTIONS: readonly string[] = TIME_ZONES.map((zone) => zone.id);

/** A zone's label, or its id for one the list doesn't know. */
export const timeZoneLabel = (id: string): string =>
  TIME_ZONES.find((zone) => zone.id === id)?.label ?? id;
