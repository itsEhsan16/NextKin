/**
 * The Discover location picker's option list and its search, kept pure so both the sheet and the
 * unit test read the same source (the `profileForms.ts` pattern).
 *
 * The list is static — it never loads and never fails — so the sheet has no loading or error
 * state; see the note in `LocationSheetBody`.
 */
import { CITY_SUGGESTIONS } from '@/data/models';

export type LocationOptionKind =
  /** "Anywhere in India" / "Remote only" — answers that are not a place at all. */
  | 'broad'
  /** One of the metros the listings hire in. */
  | 'city';

export type LocationOption = {
  /** The exact string the store records and the Discover header chip shows. */
  value: string;
  kind: LocationOptionKind;
};

export const ANYWHERE_IN_INDIA = 'Anywhere in India';
export const REMOTE_ONLY = 'Remote only';

/**
 * `CITY_SUGGESTIONS` already carries the two non-city answers at its end (as "Anywhere in India"
 * and "Remote"). They are pulled out here rather than listed twice, and "Remote" is worded
 * "Remote only" — the Discover header already has a "Remote only" chip, and two controls that
 * mean the same thing must not read differently.
 */
const NON_CITY_SUGGESTIONS: readonly string[] = ['Anywhere in India', 'Remote'];

/**
 * The store seeds `location` as "Bengaluru, India", and that string is what the header chip
 * shows, so the picker has to offer it verbatim or the seeded choice would come up unmarked.
 * Every suggestion is an Indian metro, so the country is the same for all of them.
 */
export const cityLocationLabel = (city: string): string => `${city}, India`;

/** The two broad answers, always offered — no search term can rule them out. */
export const BROAD_LOCATION_OPTIONS: readonly LocationOption[] = [
  { value: ANYWHERE_IN_INDIA, kind: 'broad' },
  { value: REMOTE_ONLY, kind: 'broad' },
];

export const CITY_LOCATION_OPTIONS: readonly LocationOption[] = CITY_SUGGESTIONS.filter(
  (city) => !NON_CITY_SUGGESTIONS.includes(city),
).map((city) => ({ value: cityLocationLabel(city), kind: 'city' as const }));

/** The whole picker, in the order it is drawn: the broad answers first, then the cities. */
export const LOCATION_OPTIONS: readonly LocationOption[] = [
  ...BROAD_LOCATION_OPTIONS,
  ...CITY_LOCATION_OPTIONS,
];

/** Case-insensitive and whitespace-tolerant, inside the string as well as around it. */
const normalise = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ');

export function matchesLocationQuery(option: LocationOption, query: string): boolean {
  const needle = normalise(query);
  return needle.length === 0 || normalise(option.value).includes(needle);
}

/** The cities left after the search box. Empty is a real answer — the sheet says so. */
export function filterCityOptions(query: string): LocationOption[] {
  return CITY_LOCATION_OPTIONS.filter((option) => matchesLocationQuery(option, query));
}

/** The full list for a query: the broad answers survive it, the cities are narrowed by it. */
export function filterLocationOptions(query: string): LocationOption[] {
  return [...BROAD_LOCATION_OPTIONS, ...filterCityOptions(query)];
}
