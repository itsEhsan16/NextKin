import { describe, expect, it } from 'vitest';

import { canonicalJson, fingerprint } from '../src/canonical';
import { KB } from '../src/datasets/kb';
import { TAXONOMY } from '../src/datasets/taxonomy';
import { MARKETS } from '../src/markets';
import { RUBRICS, rubricById, runReason, type RubricVersion } from '../src/provenance';
import { score } from '../src/rubric';
import { backendInput } from './fixtures/documents';

/**
 * Pinned fingerprints of every published version. Editing a published rubric changes its
 * fingerprint and fails here: the change has to ship as a new version (G15, P8-01).
 */
const PINNED: Record<string, string> = {
  'rubric-1': 'f1:71283963e2dd2d1e',
  'rubric-2': 'f1:b6446afd23c3b330',
};

describe('the versioned method (P8-01)', () => {
  it('published rubric versions are frozen and pinned', () => {
    const rubric = rubricById('rubric-1');
    expect(Object.isFrozen(rubric)).toBe(true);
    expect(Object.isFrozen(rubric.components)).toBe(true);
    expect(() => {
      (rubric.components[0] as { weightBps: number }).weightBps = 5000;
    }).toThrow();
    for (const [id, pinned] of Object.entries(PINNED)) expect(fingerprint(rubricById(id)), id).toBe(pinned);
    expect(Object.keys(RUBRICS)).toEqual(Object.keys(PINNED));
  });

  it('the starter datasets carry their versions', () => {
    expect([TAXONOMY.version, KB.version, MARKETS.version]).toEqual(['taxonomy-0.1.0', 'kb-0.1.0', 'markets-0.1.0']);
  });

  it('a stored run reproduces byte for byte at its versions', () => {
    for (const rubricId of Object.keys(PINNED)) {
      const stored = canonicalJson(score(backendInput({ rubricId })));
      expect(canonicalJson(score(backendInput({ rubricId }))), rubricId).toBe(stored);
    }
    expect(score(backendInput()).stamp.rubric).toBe('rubric-2');
  });

  it('rubric-2 changes only the years ceiling; a fair JD scores the same under both', () => {
    const method = (r: RubricVersion) => ({ ...r, id: '', publishedOn: '', rationale: '', yearsCappedAtTechAge: undefined });
    expect(method(rubricById('rubric-2'))).toEqual(method(rubricById('rubric-1')));
    expect(rubricById('rubric-2').yearsCappedAtTechAge).toBe(true);
    expect(score(backendInput({ rubricId: 'rubric-2' })).total).toBe(score(backendInput({ rubricId: 'rubric-1' })).total);
  });

  it('a weight change is a new version and leaves stored runs untouched', () => {
    const stored = canonicalJson(score(backendInput()));
    const next: RubricVersion = {
      ...rubricById('rubric-1'),
      id: 'rubric-test-2',
      components: [
        { key: 'keywords', weightBps: 5000 },
        { key: 'timeline', weightBps: 2000 },
        { key: 'sections', weightBps: 1000 },
        { key: 'formatting', weightBps: 1000 },
        { key: 'achievements', weightBps: 1000 },
      ],
    };
    // The registry refuses a new version at run time: publishing one means editing the source.
    expect(() => {
      (RUBRICS as Record<string, RubricVersion>)['rubric-test-2'] = next;
    }).toThrow();
    const rescored = score(backendInput({ rubric: next }));
    expect(rescored.stamp.rubric).toBe('rubric-test-2');
    expect(rescored.total).not.toBe(score(backendInput()).total);
    expect(canonicalJson(score(backendInput()))).toBe(stored);
  });

  it('labels a re-score by why it happened', () => {
    const a = score(backendInput());
    const sameAgain = score(backendInput());
    const edited = score(backendInput({ document: { ...backendInput().document, summary: 'Changed summary for this test only.' } }));
    const run = (r: typeof a) => ({ stamp: r.stamp, contentFingerprint: r.contentFingerprint });
    expect(runReason(undefined, run(a)).reason).toBe('content_change');
    expect(runReason(run(a), run(sameAgain))).toEqual({ reason: 'content_change', methodChanged: false, contentChanged: false });
    expect(runReason(run(a), run(edited))).toMatchObject({ reason: 'content_change', contentChanged: true });
    const newMethod = { ...run(a), stamp: { ...a.stamp, rubric: 'rubric-2', rubricFingerprint: 'f1:0000000000000000' } };
    expect(runReason(run(a), newMethod)).toEqual({ reason: 'method_change', methodChanged: true, contentChanged: false });
  });
});
