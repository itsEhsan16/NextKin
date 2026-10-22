import { describe, expect, it } from 'vitest';

import { paperForLocation } from '../src/markets';

/** The paper a resume is set on (owner, toreview §130): Letter in the US and Canada, A4 elsewhere. */
describe('paperForLocation', () => {
  it('Letter for the United States and Canada', () => {
    for (const place of ['Seattle, WA', 'Austin, Texas, USA', 'New York', 'United States', 'Toronto, ON, Canada', 'Vancouver']) {
      expect(paperForLocation(place), place).toBe('letter');
    }
  });

  it('A4 everywhere else', () => {
    for (const place of ['Muzaffarpur, Bihar, India', 'Berlin, Germany', 'Sydney, Australia', 'London, UK', 'Dubai']) {
      expect(paperForLocation(place), place).toBe('a4');
    }
  });

  it('Letter, as before, when no location is known', () => {
    expect(paperForLocation(undefined)).toBe('letter');
    expect(paperForLocation('  ')).toBe('letter');
  });
});
