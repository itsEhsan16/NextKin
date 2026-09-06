import { CITY_SUGGESTIONS } from '@/data/models';
import {
  ANYWHERE_IN_INDIA,
  BROAD_LOCATION_OPTIONS,
  CITY_LOCATION_OPTIONS,
  LOCATION_OPTIONS,
  REMOTE_ONLY,
  cityLocationLabel,
  filterCityOptions,
  filterLocationOptions,
} from '@/features/jobs/locationOptions';

const values = (options: readonly { value: string }[]) => options.map((option) => option.value);

describe('locationOptions (Discover location picker)', () => {
  it('assembles the two broad answers ahead of every city suggestion', () => {
    expect(values(BROAD_LOCATION_OPTIONS)).toEqual([ANYWHERE_IN_INDIA, REMOTE_ONLY]);

    // Every metro in the shared suggestion list is offered, and only the metros: the two
    // non-city entries are lifted out into the broad group rather than listed twice.
    const metros = CITY_SUGGESTIONS.filter(
      (city) => city !== 'Anywhere in India' && city !== 'Remote',
    );
    expect(values(CITY_LOCATION_OPTIONS)).toEqual(metros.map(cityLocationLabel));
    expect(values(CITY_LOCATION_OPTIONS)).not.toContain('Remote');

    expect(values(LOCATION_OPTIONS)).toEqual([
      ...values(BROAD_LOCATION_OPTIONS),
      ...values(CITY_LOCATION_OPTIONS),
    ]);
    expect(CITY_LOCATION_OPTIONS.every((option) => option.kind === 'city')).toBe(true);
    expect(BROAD_LOCATION_OPTIONS.every((option) => option.kind === 'broad')).toBe(true);
  });

  it("offers the seeded 'Bengaluru, India' verbatim, so the header's choice comes up marked", () => {
    expect(values(CITY_LOCATION_OPTIONS)).toContain('Bengaluru, India');
  });

  it('narrows to the matching cities, ignoring case and surrounding or doubled spaces', () => {
    expect(values(filterCityOptions('pune'))).toEqual(['Pune, India']);
    expect(values(filterCityOptions('PUNE'))).toEqual(['Pune, India']);
    expect(values(filterCityOptions('  pune  '))).toEqual(['Pune, India']);
    expect(values(filterCityOptions('delhi  ncr'))).toEqual(['Delhi NCR, India']);
    // A partial term is enough — the field filters as you type.
    expect(values(filterCityOptions('mum'))).toEqual(['Mumbai, India']);
  });

  it('returns every city when nothing is typed, and none when nothing matches', () => {
    expect(filterCityOptions('')).toHaveLength(CITY_LOCATION_OPTIONS.length);
    expect(filterCityOptions('   ')).toHaveLength(CITY_LOCATION_OPTIONS.length);
    expect(filterCityOptions('zzzz')).toEqual([]);
  });

  it('always offers the two broad answers — empty query, matching query or none at all', () => {
    for (const query of ['', 'pune', 'zzzz']) {
      expect(values(filterLocationOptions(query)).slice(0, 2)).toEqual([
        ANYWHERE_IN_INDIA,
        REMOTE_ONLY,
      ]);
    }
    expect(values(filterLocationOptions('zzzz'))).toEqual([ANYWHERE_IN_INDIA, REMOTE_ONLY]);
    expect(values(filterLocationOptions(''))).toEqual(values(LOCATION_OPTIONS));
  });
});
