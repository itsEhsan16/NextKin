/**
 * Market profiles for the three launch markets, version markets-0.1.0 (V2 §8.5, §16.4;
 * ImBackendImplementationPlan P8-08, old Q-07): spelling, date format, length guidance, section
 * names, the work-authorization line, and the personal details a resume must never carry there.
 *
 * Lint reads these to suggest; nothing here scores. The target market comes from the JD's location
 * or the user's choice.
 */

import { deepFreeze } from './canonical';
import { phraseKey } from './text';

export type MarketId = 'us' | 'de' | 'au';

export interface MarketProfile {
  id: MarketId;
  spelling: 'en-US' | 'en-AU';
  /** How role dates are written. */
  dateFormat: 'MMM YYYY' | 'MM/YYYY';
  maxPages: number;
  sectionNames: Readonly<Record<'summary' | 'experience' | 'education' | 'skills', string>>;
  /** Whether a candidate from elsewhere should state their work authorization. */
  workAuthorizationLine: boolean;
  /** Never on a resume in this market (§8.5). */
  forbidden: readonly ('photo' | 'date_of_birth' | 'marital_status')[];
}

export interface MarketSet {
  id: 'markets';
  version: string;
  profiles: Readonly<Record<MarketId, MarketProfile>>;
}

const FORBIDDEN = ['photo', 'date_of_birth', 'marital_status'] as const;

export const MARKETS: MarketSet = deepFreeze({
  id: 'markets',
  version: 'markets-0.1.0',
  profiles: {
    us: {
      id: 'us',
      spelling: 'en-US',
      dateFormat: 'MMM YYYY',
      maxPages: 2,
      sectionNames: { summary: 'Summary', experience: 'Experience', education: 'Education', skills: 'Skills' },
      workAuthorizationLine: true,
      forbidden: FORBIDDEN,
    },
    de: {
      id: 'de',
      spelling: 'en-US',
      dateFormat: 'MM/YYYY',
      maxPages: 2,
      sectionNames: { summary: 'Profile', experience: 'Professional experience', education: 'Education', skills: 'Skills' },
      workAuthorizationLine: true,
      forbidden: FORBIDDEN,
    },
    au: {
      id: 'au',
      spelling: 'en-AU',
      dateFormat: 'MMM YYYY',
      maxPages: 3,
      sectionNames: { summary: 'Career summary', experience: 'Employment history', education: 'Education', skills: 'Key skills' },
      workAuthorizationLine: true,
      forbidden: FORBIDDEN,
    },
  },
});

/**
 * en-US → en-AU spellings, one pair per line. en-AU follows British spelling for these. Matched as
 * whole words, so "program" (the same in both for software) is deliberately absent.
 */
const US_TO_AU: readonly (readonly [string, string])[] = [
  ['optimize', 'optimise'], ['optimized', 'optimised'], ['optimizing', 'optimising'], ['optimization', 'optimisation'],
  ['organize', 'organise'], ['organized', 'organised'], ['organizing', 'organising'], ['organization', 'organisation'], ['organizations', 'organisations'],
  ['analyze', 'analyse'], ['analyzed', 'analysed'], ['analyzing', 'analysing'],
  ['prioritize', 'prioritise'], ['prioritized', 'prioritised'], ['prioritizing', 'prioritising'],
  ['standardize', 'standardise'], ['standardized', 'standardised'],
  ['utilize', 'utilise'], ['utilized', 'utilised'],
  ['modernize', 'modernise'], ['modernized', 'modernised'],
  ['customize', 'customise'], ['customized', 'customised'],
  ['minimize', 'minimise'], ['minimized', 'minimised'], ['maximize', 'maximise'], ['maximized', 'maximised'],
  ['color', 'colour'], ['colors', 'colours'], ['behavior', 'behaviour'], ['behaviors', 'behaviours'],
  ['center', 'centre'], ['centers', 'centres'], ['labor', 'labour'], ['favor', 'favour'],
  ['catalog', 'catalogue'], ['dialog', 'dialogue'], ['defense', 'defence'], ['license', 'licence'],
  ['modeling', 'modelling'], ['modeled', 'modelled'], ['traveled', 'travelled'], ['traveling', 'travelling'],
  ['enrollment', 'enrolment'], ['fulfill', 'fulfil'], ['fulfillment', 'fulfilment'],
  ['canceled', 'cancelled'], ['labeled', 'labelled'], ['labeling', 'labelling'],
];

const SPELLING: Readonly<Record<MarketProfile['spelling'], ReadonlyMap<string, string>>> = {
  'en-AU': new Map(US_TO_AU.map(([us, au]) => [us, au])),
  'en-US': new Map(US_TO_AU.map(([us, au]) => [au, us])),
};

function matchCase(source: string, target: string): string {
  if (source === source.toUpperCase() && source.length > 1) return target.toUpperCase();
  if (source[0] === source[0]!.toUpperCase()) return target[0]!.toUpperCase() + target.slice(1);
  return target;
}

/** Each word that a market spells differently, with its replacement. */
export function spellingDifferences(text: string, spelling: MarketProfile['spelling']): { word: string; replacement: string; start: number }[] {
  const table = SPELLING[spelling];
  const out: { word: string; replacement: string; start: number }[] = [];
  for (const match of text.matchAll(/\p{L}+/gu)) {
    const word = match[0];
    const replacement = table.get(word.toLowerCase());
    if (replacement) out.push({ word, replacement: matchCase(word, replacement), start: match.index });
  }
  return out;
}

/** The text in a market's spelling (deterministic, word for word). */
export function toMarketSpelling(text: string, spelling: MarketProfile['spelling']): string {
  let out = '';
  let last = 0;
  for (const diff of spellingDifferences(text, spelling)) {
    out += text.slice(last, diff.start) + diff.replacement;
    last = diff.start + diff.word.length;
  }
  return out + text.slice(last);
}

const PLACES: readonly [MarketId, readonly string[]][] = [
  ['de', ['germany', 'deutschland', 'berlin', 'munich', 'münchen', 'hamburg', 'frankfurt', 'cologne', 'köln', 'stuttgart', 'düsseldorf', 'leipzig']],
  ['au', ['australia', 'sydney', 'melbourne', 'brisbane', 'perth', 'adelaide', 'canberra', 'nsw', 'vic', 'qld']],
  ['us', ['united states', 'usa', 'us', 'new york', 'san francisco', 'seattle', 'austin', 'boston', 'chicago', 'los angeles', 'remote us', 'ca', 'ny', 'tx', 'wa']],
];

/** Places that print on US Letter: the United States and Canada. Everywhere else uses A4. */
const LETTER_PLACES: readonly string[] = [
  ...(PLACES.find(([m]) => m === 'us')?.[1] ?? []),
  'america', 'united states of america', 'canada', 'toronto', 'vancouver', 'montreal', 'ottawa', 'calgary', 'edmonton', 'ontario', 'quebec', 'british columbia', 'alberta',
];

/**
 * The paper a resume is set on, by where the person is (owner, toreview §130): Letter for the
 * United States and Canada, A4 everywhere else. Without a location, Letter, as before.
 */
export function paperForLocation(location: string | null | undefined): 'letter' | 'a4' {
  if (!location?.trim()) return 'letter';
  const key = ` ${phraseKey(location).replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/ +/g, ' ')} `;
  return LETTER_PLACES.some((name) => key.includes(` ${name} `)) ? 'letter' : 'a4';
}

/** The market a location names, if any. */
export function marketForLocation(location: string | undefined): MarketId | undefined {
  if (!location) return undefined;
  const key = ` ${phraseKey(location).replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/ +/g, ' ')} `;
  for (const [market, names] of PLACES) if (names.some((name) => key.includes(` ${name} `))) return market;
  return undefined;
}
