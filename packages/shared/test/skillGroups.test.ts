import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { describe, expect, it } from 'vitest';

import { ADDED_PER_LINE, OVERFLOW_LINE, SOFT_LINE, groupFor, placeInGroups, tidyGroups } from '../src/scoring/skillGroups';

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

describe('accepted keywords do not pile onto one line (toreview §212)', () => {
  const LINES = [
    { label: 'Languages', names: ['Python', 'SQL'] },
    { label: 'Product & AI', names: ['product thinking'] },
  ];
  const many = ['market sizing', 'user stories', 'acceptance criteria', 'customer calls', 'surveys', 'product metrics', 'market analysis', 'competitive analysis', 'prioritization frameworks', 'enterprise SaaS', 'procurement software'];

  it('a line takes a few new keywords; the rest open a line of their own', () => {
    const placed = placeInGroups(LINES, many, TAXONOMY);
    const product = placed.find((g) => g.label === 'Product & AI')!;
    expect(product.names.length).toBeLessThanOrEqual(1 + ADDED_PER_LINE);
    expect(placed.find((g) => g.label === OVERFLOW_LINE)!.names.length).toBeGreaterThan(0);
    expect(placed.flatMap((g) => g.names)).toEqual(expect.arrayContaining(many));
  });

  it('soft skills get their own line, never a technical one', () => {
    const placed = placeInGroups(LINES, ['Leadership', 'market sizing', 'growth mindset'], TAXONOMY, { soft: ['leadership', 'Growth mindset'] });
    expect(placed.find((g) => g.label === SOFT_LINE)!.names).toEqual(['Leadership', 'growth mindset']);
    expect(placed.find((g) => g.label === 'Languages')!.names).toEqual(['Python', 'SQL']);
  });
});

describe('the stack side of a skill line (toreview §170)', () => {
  const LINES = [
    { label: 'Front End', names: ['React.js', 'Next.js', 'TypeScript'] },
    { label: 'Back End & APIs', names: ['REST APIs', 'Node.js'] },
    { label: 'Practices & Tools', names: ['Git'] },
  ];

  it('puts a back-end framework on the back-end line, not with React', () => {
    expect(groupFor('Spring Boot', LINES, TAXONOMY)).toBe(1);
    expect(groupFor('Django', LINES, TAXONOMY)).toBe(1);
    expect(groupFor('Vue', LINES, TAXONOMY)).toBe(0);
  });

  it('never files a back-end framework on a front-end line by category alone', () => {
    const frontOnly = [LINES[0]!, LINES[2]!];
    expect(groupFor('Spring Boot', frontOnly, TAXONOMY)).toBe(1);
  });
});

describe('a keyword with no room for a new line (owner, 2026-11-25)', () => {
  it('joins a line that is already there when the resume has twelve, so none is left for "Also"', () => {
    const twelve = Array.from({ length: 12 }, (_, i) => ({ label: `Line ${i}`, names: [`skill ${i}`] }));
    const added = Array.from({ length: ADDED_PER_LINE + 3 }, (_, i) => `brand new keyword ${i}`);
    const placed = placeInGroups(twelve, added, TAXONOMY);
    expect(placed).toHaveLength(12);
    const listed = placed.flatMap((g) => g.names);
    expect(added.every((k) => listed.includes(k))).toBe(true);
  });
});

describe('tidying skill lines (toreview §170)', () => {
  it('merges lines with the same label and lists each skill once', () => {
    const tidy = tidyGroups(
      [
        { label: 'Also', names: ['Express'] },
        { label: 'Databases', names: ['PostgreSQL', 'postgres'] },
        { label: 'also', names: ['Helm', 'Express'] },
        { label: 'Empty', names: [] },
      ],
      TAXONOMY,
    );
    expect(tidy).toEqual([
      { label: 'Also', names: ['Express', 'Helm'] },
      { label: 'Databases', names: ['PostgreSQL'] },
    ]);
  });
});
