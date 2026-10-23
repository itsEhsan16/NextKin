import { describe, expect, it } from 'vitest';

import { TAXONOMY } from '../src/datasets/taxonomy';
import { evidenceOf, type ScoringDocument } from '../src/document';
import { phraseIndex, phraseMentions } from '../src/phrases';
import { rubricById } from '../src/provenance';
import { buildLedger, requirementsFromJd } from '../src/requirements';
import { AS_OF } from './fixtures/documents';

/** JD phrases the taxonomy does not know, found in a resume's own text (toreview §112). Synthetic. */

const index = phraseIndex(['x:user interfaces', 'x:code reviews', 'x:kyc', 'react']);

describe('phrase mentions', () => {
  it('finds whole words in order, plurals and punctuation aside, and ignores taxonomy ids', () => {
    expect(index.map((p) => p.id)).toEqual(['x:user interfaces', 'x:code reviews', 'x:kyc']);
    const hits = phraseMentions('Built the user interface, ran code-reviews and KYC checks.', index);
    expect(hits.map((h) => [h.id, h.surface])).toEqual([
      ['x:user interfaces', 'user interface'],
      ['x:code reviews', 'code-reviews'],
      ['x:kyc', 'KYC'],
    ]);
  });

  it('does not match inside a word or out of order', () => {
    expect(phraseMentions('Interfaces for users; kycx', index)).toEqual([]);
  });
});

describe('a JD phrase met by bullet text', () => {
  const jd = { requiredSkills: ['user interfaces'], preferredSkills: ['code reviews'], rawText: 'Build user interfaces. Join code reviews.' };
  const requirements = requirementsFromJd(jd, TAXONOMY);
  const phrases = requirements.flatMap((r) => (r.skill && !r.skill.known ? [r.skill.id] : []));
  const doc: ScoringDocument = {
    skills: [],
    roles: [{ id: 'r1', title: 'Frontend Developer', company: 'Acme', start: { year: 2023, month: 1 }, end: null, bullets: ['Built responsive user interfaces in React for 3 clients'] }],
    education: [],
    certifications: [],
    contact: { email: true, phone: true, location: true },
  } as unknown as ScoringDocument;

  it('counts as shown in that role, where it used to be a gap', () => {
    const without = buildLedger({ requirements, evidence: evidenceOf(doc, TAXONOMY).evidence, rubric: rubricById(), asOf: AS_OF });
    const withPhrases = buildLedger({ requirements, evidence: evidenceOf(doc, TAXONOMY, { minCopiedWords: 8, phrases }).evidence, rubric: rubricById(), asOf: AS_OF });
    expect(without.entries.find((e) => e.text === 'user interfaces')?.status).toBe('gap');
    expect(withPhrases.entries.find((e) => e.text === 'user interfaces')).toMatchObject({ status: 'met', roleIds: ['r1'] });
    expect(withPhrases.entries.find((e) => e.text === 'code reviews')?.status).toBe('gap');
  });
});
