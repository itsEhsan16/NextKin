import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { describe, expect, it } from 'vitest';

import { groupFor, placeInGroups } from '../src/scoring/skillGroups';

/** A new keyword on its skill line, as Jobright places them (toreview §113). Synthetic. */

const GROUPS = [
  { label: 'Front End', names: ['React', 'TypeScript', 'HTML'] },
  { label: 'Databases', names: ['PostgreSQL', 'schema design'] },
  { label: 'Web Fundamentals', names: ['HTTP request/response lifecycle', 'caching'] },
  { label: 'Practices & Tools', names: ['Git', 'debugging'] },
];

describe('placing a keyword on a skill line', () => {
  it('by category, then shared words, then the catch-all line', () => {
    expect(groupFor('Vue', GROUPS, TAXONOMY)).toBe(0);
    expect(groupFor('MongoDB', GROUPS, TAXONOMY)).toBe(1);
    expect(groupFor('Web application architecture', GROUPS, TAXONOMY)).toBe(2);
    expect(groupFor('logical reasoning', GROUPS, TAXONOMY)).toBe(3);
    expect(groupFor('Vue', [], TAXONOMY)).toBe(-1);
  });

  it('adds each new keyword once, and never one already listed', () => {
    const placed = placeInGroups(GROUPS, ['Vue', 'react', 'logical reasoning', 'Vue'], TAXONOMY);
    expect(placed[0]!.names).toEqual(['React', 'TypeScript', 'HTML', 'Vue']);
    expect(placed[3]!.names).toEqual(['Git', 'debugging', 'logical reasoning']);
    expect(GROUPS[0]!.names).toHaveLength(3);
  });
});
