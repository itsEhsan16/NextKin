import { describe, expect, it } from 'vitest';

import { statesResult } from '../src/tailor/customize';
import { FIGURE_KINDS, lineWithFigure, pickedLine } from '../src/tailor/figures';

const LINE = 'Built the order API in Node.js.';

describe('figures by picking (toreview §149)', () => {
  it('builds a line that counts as a measured result, for every kind and size', () => {
    for (const kind of FIGURE_KINDS) {
      for (const size of kind.sizes) {
        const line = pickedLine(LINE, kind.key, size);
        expect(line).not.toBeNull();
        expect(statesResult(line!)).toBe(true);
      }
    }
  });

  it('joins the clause after the line’s own punctuation', () => {
    expect(lineWithFigure('Built the API.', 'cutting costs by about 25%')).toBe(
      'Built the API, cutting costs by about 25%.',
    );
    expect(lineWithFigure('Built the API;  ', 'reaching 100+ users')).toBe(
      'Built the API, reaching 100+ users.',
    );
  });

  it('needs both picks, and only a size the kind offers', () => {
    expect(pickedLine(LINE, null, '25%')).toBeNull();
    expect(pickedLine(LINE, 'faster', null)).toBeNull();
    expect(pickedLine(LINE, 'users', '25%')).toBeNull();
    expect(pickedLine(LINE, 'faster', '25%')).toBe(
      'Built the order API in Node.js, cutting the time it took by about 25%.',
    );
  });
});
