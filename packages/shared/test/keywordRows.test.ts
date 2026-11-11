import { describe, expect, it } from 'vitest';

import type { TailorComparison } from '../src/models/tailor';
import type { FixPlan, PlanStep } from '../src/scoring/fixPlan';
import { bucketCounts, filterRows, impactSegments, keywordRowsOf, sortRows } from '../src/tailor/keywordRows';

/** The "Choose keywords" table's rows (owner's mockup, 2026-11-11). Synthetic. */

const step = (keyword: string, worth: number | null): PlanStep => ({
  id: `kw:${keyword}`,
  kind: 'keyword',
  title: keyword,
  have: 'Not on your resume',
  worth,
  basis: `${keyword} basis`,
  who: 'you',
  keyword,
});

const plan: FixPlan = {
  score: 6.7,
  parts: [],
  steps: [step('Jira', 0.2), step('Agile', 0.4), step('React', 0.5), step('Quarkwise', null)],
};

const comparison: TailorComparison = {
  resumeId: 'r1',
  jdId: 'jd1',
  score: 67,
  improvements: [],
  plan,
  keywords: [
    { label: 'TypeScript', onResume: true, source: 'required', top: true },
    { label: 'Jira', onResume: false, source: 'required' },
    { label: 'Agile', onResume: false, source: 'required' },
    { label: 'React', onResume: false, source: 'required', top: true },
    { label: 'Quarkwise', onResume: false, source: 'description' },
    { label: 'teamwork', onResume: false, source: 'required', kind: 'soft' },
  ],
};

describe('keywordRowsOf', () => {
  const rows = keywordRowsOf(comparison);
  const by = (label: string) => rows.find((r) => r.label === label)!;

  it('keeps only what the resume lacks', () => {
    expect(rows.map((r) => r.label)).not.toContain('TypeScript');
    expect(rows).toHaveLength(5);
  });

  it('puts required keywords under Missing, preferred and soft ones under Optional', () => {
    expect(by('React').tab).toBe('missing');
    expect(by('Quarkwise').tab).toBe('optional');
    expect(by('teamwork').tab).toBe('optional');
  });

  it('groups by the taxonomy category, soft skills and unknowns apart', () => {
    expect(by('React')).toMatchObject({ bucket: 'technical', tag: 'Framework' });
    expect(by('Jira')).toMatchObject({ bucket: 'tools', tag: 'Tool' });
    expect(by('Agile')).toMatchObject({ bucket: 'domains', tag: 'Methodology' });
    expect(by('teamwork')).toMatchObject({ bucket: 'soft', tag: 'Soft skill' });
    expect(by('Quarkwise')).toMatchObject({ bucket: 'other', tag: null });
  });

  it('prices each row from its plan step, null when unpriced', () => {
    expect(by('React')).toMatchObject({ worth: 0.5, basis: 'React basis' });
    expect(by('Quarkwise').worth).toBeNull();
    expect(by('teamwork').worth).toBeNull();
  });

  it('lists top keywords first, then by worth', () => {
    expect(rows.map((r) => r.label)).toEqual(['React', 'Agile', 'Jira', 'Quarkwise', 'teamwork']);
  });
});

describe('sortRows', () => {
  const rows = keywordRowsOf(comparison);
  it('sorts by worth either way with unpriced rows last', () => {
    expect(sortRows(rows, 'worth-asc').map((r) => r.label)).toEqual(['Jira', 'Agile', 'React', 'Quarkwise', 'teamwork']);
    expect(sortRows(rows, 'worth-desc').map((r) => r.label).slice(0, 3)).toEqual(['React', 'Agile', 'Jira']);
  });
});

describe('filterRows and bucketCounts', () => {
  const rows = keywordRowsOf(comparison);
  it('filters by tab, group and search', () => {
    expect(filterRows(rows, { tab: 'missing' }).map((r) => r.label)).toEqual(['React', 'Agile', 'Jira']);
    expect(filterRows(rows, { tab: 'missing', bucket: 'tools' }).map((r) => r.label)).toEqual(['Jira']);
    expect(filterRows(rows, { tab: 'missing', query: 're' }).map((r) => r.label)).toEqual(['React']);
    expect(filterRows(rows, { tab: 'missing', query: 'method' }).map((r) => r.label)).toEqual(['Agile']);
    expect(filterRows(rows, { tab: 'missing', query: 'zzz' })).toEqual([]);
  });

  it('counts each group within a tab, leaving empty ones out', () => {
    expect(bucketCounts(rows, 'missing')).toEqual([
      { bucket: 'technical', count: 1 },
      { bucket: 'tools', count: 1 },
      { bucket: 'domains', count: 1 },
    ]);
  });
});

describe('impactSegments', () => {
  it('fills at least one of five for any positive worth, none without one', () => {
    expect(impactSegments(0.5, 0.5)).toBe(5);
    expect(impactSegments(0.2, 0.5)).toBe(2);
    expect(impactSegments(0.01, 0.5)).toBe(1);
    expect(impactSegments(null, 0.5)).toBe(0);
    expect(impactSegments(0.3, 0)).toBe(0);
  });
});
