import { describe, expect, it } from 'vitest';

import { isRestored, restoreLine, summarySentences } from '../src/scoring/lineRestore';
import { applyDocument, documentOf } from '../src/scoring/resumeDocument';
import { versionChanges } from '../src/scoring/versionChanges';
import { CANONICAL_SCHEMA_VERSION, type CanonicalResumeJson } from '../src/schemas/resumeContent';
import type { ResumeContent } from '../src/models/resumeContent';

/** Restore for a line the tailor's review took out (§202): back where it sat. Synthetic people. */

const line = (id: string, text: string) => ({ id, text, evidence: [] as string[], origin: 'user' as const });

const DOC: CanonicalResumeJson = {
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  headline: 'Developer',
  summary: line('s', 'Java developer who built REST APIs for 12 stores. Ships React screens.'),
  header: { name: 'Sam Rivera', items: [{ text: 'Patna, India' }, { text: 'sam@example.com' }] },
  skills: [],
  roles: [{ roleId: 'intern', company: 'Acme Apps', title: 'Developer Intern', start: '2025-01', end: '2025-06', skills: [], bullets: [line('a', 'Built REST APIs'), line('c', 'Wrote the tests')] }],
  education: [],
  certifications: [],
  projects: [],
};

const IDS = { resumeId: 'r', versionId: 'v', revision: '1' };
const OWNER = { name: 'Sam Rivera' };

describe('summarySentences', () => {
  it('splits at a full stop before a capital, never inside Node.js or e.g.', () => {
    expect(summarySentences('Builds APIs in Node.js and e.g. Express. Ships fast! Open to relocating to Lucknow.')).toEqual(['Builds APIs in Node.js and e.g. Express.', 'Ships fast!', 'Open to relocating to Lucknow.']);
    expect(summarySentences(null)).toEqual([]);
  });
});

describe('restoreLine', () => {
  const doc = documentOf(DOC, IDS, OWNER);

  it('puts a header statement back at its place, and the save writes it', () => {
    const restore = { at: 'header', index: 1, text: 'Open to relocating to Lucknow' } as const;
    expect(isRestored(doc, restore)).toBe(false);
    const write = restoreLine(doc, restore)!;
    expect(write.header.items.map((i) => i.text)).toEqual(['Patna, India', 'Open to relocating to Lucknow', 'sam@example.com']);
    expect(applyDocument(DOC, write).header?.items.map((i) => i.text)).toEqual(['Patna, India', 'Open to relocating to Lucknow', 'sam@example.com']);
  });

  it('puts a summary sentence and a bullet back where they sat', () => {
    const summary = restoreLine(doc, { at: 'summary', index: 1, text: 'Open to relocating.' })!;
    expect(summary.summary).toBe('Java developer who built REST APIs for 12 stores. Open to relocating. Ships React screens.');
    const bullet = restoreLine(doc, { at: 'bullet', owner: 'intern', index: 1, text: 'Ran the stand-ups' })!;
    expect(bullet.experience[0]!.bullets.map((b) => b.text)).toEqual(['Built REST APIs', 'Ran the stand-ups', 'Wrote the tests']);
    expect(isRestored({ ...doc, ...bullet }, { at: 'bullet', owner: 'intern', index: 1, text: 'Ran the stand-ups' })).toBe(true);
  });

  it('has nothing to restore into when the role is gone', () => {
    expect(restoreLine(doc, { at: 'bullet', owner: 'gone', index: 0, text: 'x' })).toBeNull();
  });
});

describe('versionChanges with the review’s removals', () => {
  const content = (bullets: string[]): ResumeContent => ({ kind: 'resume', resumeId: 'r', versionId: 'v', summary: 'A dev.', skills: [], experience: [{ id: 'intern', company: 'Acme', title: 'Dev', period: '2025', bullets }], projects: [], certifications: [], education: [] });

  it('lists a taken-out line once, with its reason and Restore', () => {
    const restore = { at: 'bullet', owner: 'intern', index: 1, text: 'Kept the stock list' } as const;
    const out = versionChanges({ before: content(['Built APIs', 'Kept the stock list']), after: content(['Built APIs']), actor: 'generation', reviewedOut: [{ where: 'Dev at Acme', text: 'Kept the stock list', reason: 'Nothing to do with this job', restore }] });
    expect(out).toEqual([{ kind: 'removed', where: 'Dev at Acme', text: 'Kept the stock list', why: 'Nothing to do with this job', restore }]);
  });
});
