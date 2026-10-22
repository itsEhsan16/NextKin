import { describe, expect, it } from 'vitest';

import { canonicalJson } from '../src/canonical';
import type { ScoringDocument } from '../src/document';
import { lint } from '../src/lint';
import { marketForLocation, MARKETS, toMarketSpelling } from '../src/markets';
import { score } from '../src/rubric';
import { backendInput, BACKEND_RESUME } from './fixtures/documents';

const withBullets = (bullets: string[], end: ScoringDocument['roles'][number]['end'] = { year: 2020, month: 2 }): ScoringDocument => ({
  ...BACKEND_RESUME,
  summary: 'I am a results-driven team player who optimized everything.',
  roles: [{ id: 'r', title: 'Engineer', company: 'X', start: { year: 2016, month: 1 }, end, bullets }],
});

describe('market profiles (P8-08)', () => {
  it('the same profile gets en-AU spelling for an Australian JD and en-US for a US one', () => {
    const text = 'Optimised the catalogue and organized the team';
    const au = MARKETS.profiles[marketForLocation('Sydney, NSW, Australia')!];
    const us = MARKETS.profiles[marketForLocation('Austin, TX, United States')!];
    expect(toMarketSpelling(text, au.spelling)).toBe('Optimised the catalogue and organised the team');
    expect(toMarketSpelling(text, us.spelling)).toBe('Optimized the catalog and organized the team');
  });

  it('reads the market from a JD location', () => {
    expect(marketForLocation('Berlin, Germany')).toBe('de');
    expect(marketForLocation('München')).toBe('de');
    expect(marketForLocation('Melbourne VIC')).toBe('au');
    expect(marketForLocation('Remote (US)')).toBe('us');
    expect(marketForLocation('Bengaluru, India')).toBeUndefined();
  });

  it('forbids a photo, a birth date and marital status in every market', () => {
    for (const market of Object.values(MARKETS.profiles)) expect([...market.forbidden].sort()).toEqual(['date_of_birth', 'marital_status', 'photo']);
  });
});

describe('the writing lint', () => {
  it('suggests spelling, pronoun, cliché, tense, repetition and length fixes', () => {
    const long = 'Worked on '.concat(Array.from({ length: 32 }, (_, i) => `item${i}`).join(' '));
    const suggestions = lint({ document: withBullets(['Manage the API', 'Manage the queue', 'Manage the team', long]), market: MARKETS.profiles.au, pages: 4 });
    const rules = new Set(suggestions.map((s) => s.rule));
    expect([...rules].sort()).toEqual(['bullet_length', 'cliche', 'first_person', 'length', 'repeated_opening', 'spelling', 'tense']);
    expect(suggestions.find((s) => s.rule === 'spelling')).toMatchObject({ replacement: 'optimised', field: 'summary' });
  });

  it('flags personal details a market forbids', () => {
    const doc = { ...withBullets(['Built things']), summary: 'Married, date of birth 1990.' };
    const rules = lint({ document: doc, market: MARKETS.profiles.de, personal: { photo: true } }).map((s) => s.id);
    expect(rules).toEqual(expect.arrayContaining(['personal_data:photo', 'personal_data:text']));
  });

  it('does not flag tense on a current role', () => {
    expect(lint({ document: withBullets(['Manage the API'], null), market: MARKETS.profiles.us }).filter((s) => s.rule === 'tense')).toEqual([]);
  });

  it('never changes a score', () => {
    const before = canonicalJson(score(backendInput()));
    lint({ document: backendInput().document, market: MARKETS.profiles.au });
    expect(canonicalJson(score(backendInput()))).toBe(before);

    // A lint-only edit (the market's spelling) leaves every number identical.
    const doc = withBullets(['Optimized the catalog for 300 merchants', 'Organized 12 releases'], null);
    const respelled = { ...doc, summary: toMarketSpelling(doc.summary!, 'en-AU'), roles: doc.roles.map((r) => ({ ...r, bullets: r.bullets.map((b) => toMarketSpelling(b, 'en-AU')) })) };
    const a = score(backendInput({ document: doc }));
    const b = score(backendInput({ document: respelled }));
    expect([b.totalBps, b.components.map((c) => c.scoreBps)]).toEqual([a.totalBps, a.components.map((c) => c.scoreBps)]);
  });
});
