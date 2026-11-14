import { describe, expect, it } from 'vitest';

import { TAXONOMY } from '../src/datasets/taxonomy';
import { phraseIndex, phraseMentions, stem } from '../src/phrases';
import { rubricById } from '../src/provenance';
import { buildLedger, requirementsFromJd, type Evidence } from '../src/requirements';
import { AS_OF } from './fixtures/documents';

/**
 * A posting's structured reading as the ledger's source (toreview §206.2): its years and its
 * conditions replace the search of the raw text, and none of it moves points it did not before.
 */

const RAW = 'We need 5+ years of experience with Go. Must be authorized to work in Germany. Fluent German is required.';

describe('requirements from a structured reading', () => {
  it('takes a skill’s years from the reading’s own line, over the sentence search', () => {
    const [go, sql] = requirementsFromJd({ requiredSkills: ['Go', 'SQL'], preferredSkills: [], rawText: RAW, stated: { skillYears: { Golang: 3, SQL: 2 } } }, TAXONOMY);
    expect(go).toMatchObject({ id: 'req:go', minYears: 3 });
    expect(sql).toMatchObject({ id: 'req:sql', minYears: 2 });
  });

  it('still reads years written into the item itself first', () => {
    const own = requirementsFromJd({ requiredSkills: ['4+ years Go'], preferredSkills: [], rawText: RAW, stated: { skillYears: { Go: 3 } } }, TAXONOMY);
    expect(own[0]).toMatchObject({ id: 'req:go', minYears: 4 });
  });

  it('a reading that ties no years to a skill is believed over the sentence search', () => {
    const read = requirementsFromJd({ requiredSkills: ['Go'], preferredSkills: [], rawText: RAW, stated: { skillYears: {} } }, TAXONOMY);
    expect(read[0]!.minYears).toBeUndefined();
    const unread = requirementsFromJd({ requiredSkills: ['Go'], preferredSkills: [], rawText: RAW, stated: { eligibility: [] } }, TAXONOMY);
    expect(unread[0]).toMatchObject({ id: 'req:go', minYears: 5 });
  });

  it('reports the reading’s conditions instead of searching the text for them', () => {
    const reqs = requirementsFromJd(
      {
        requiredSkills: ['Go'],
        preferredSkills: [],
        rawText: RAW,
        stated: {
          eligibility: [
            { kind: 'education', text: 'Bachelor’s degree in Computer Science', importance: 'required', span: { start: 0, end: 7 } },
            { kind: 'certification', text: 'AWS Certified Developer', importance: 'preferred' },
            { kind: 'certification', text: 'CKA certification' },
            { kind: 'language', text: 'Fluent German is required.' },
            { kind: 'other', text: '   ' },
          ],
        },
      },
      TAXONOMY,
    );
    const elig = reqs.filter((r) => r.kind === 'eligibility');
    expect(elig.map((r) => [r.id, r.eligibility, r.importance])).toEqual([
      ['elig:education', 'education', 'required'],
      ['elig:certification', 'certification', 'preferred'],
      ['elig:certification:2', 'certification', 'required'],
      ['elig:language', 'language', 'required'],
    ]);
    expect(elig[0]!.span).toEqual({ start: 0, end: 7 });
    // Work authorisation is in the text, but the reading did not state it: the reading is the list.
    expect(elig.some((r) => r.eligibility === 'work_authorization')).toBe(false);
  });

  it('an empty list of conditions means none, not "search the text"', () => {
    const reqs = requirementsFromJd({ requiredSkills: ['Go'], preferredSkills: [], rawText: RAW, stated: { eligibility: [] } }, TAXONOMY);
    expect(reqs.filter((r) => r.kind === 'eligibility')).toEqual([]);
  });

  it('without a reading, the text is searched as before', () => {
    const reqs = requirementsFromJd({ requiredSkills: ['Go'], preferredSkills: [], rawText: RAW }, TAXONOMY);
    expect(reqs.filter((r) => r.kind === 'eligibility').map((r) => r.eligibility).sort()).toEqual(['language', 'work_authorization']);
  });

  it('conditions never move the match', () => {
    const evidence: Evidence = { roles: [{ id: 'r1', start: { year: 2015, month: 1 }, end: null, skills: ['go'] }], listed: [] };
    const bare = requirementsFromJd({ requiredSkills: ['Go'], preferredSkills: [], stated: { eligibility: [] } }, TAXONOMY);
    const loaded = requirementsFromJd({ requiredSkills: ['Go'], preferredSkills: [], stated: { eligibility: [{ kind: 'education', text: 'PhD required' }, { kind: 'certification', text: 'CKA' }] } }, TAXONOMY);
    const a = buildLedger({ requirements: bare, evidence, rubric: rubricById(), asOf: AS_OF });
    const b = buildLedger({ requirements: loaded, evidence, rubric: rubricById(), asOf: AS_OF });
    expect(b.matchBps).toBe(a.matchBps);
    expect(b.counts).toEqual(a.counts);
    expect(b.entries.filter((e) => e.status === 'eligibility')).toHaveLength(2);
  });
});

describe('a word’s forms, for phrases the taxonomy does not know', () => {
  it.each([
    [['dashboards', 'dashboard']],
    [['automate', 'automated', 'automating', 'automation', 'automations']],
    [['integrate', 'integration', 'integrating', 'integrations']],
    [['policies', 'policy']],
    [['testing', 'tested', 'tests', 'test']],
    [['report', 'reports', 'reporting', 'reported']],
  ])('%j meet', (forms) => {
    expect(new Set(forms.map(stem)).size).toBe(1);
  });

  it.each([
    ['css', 'cs'],
    ['status', 'statu'],
    ['analysis', 'analysi'],
    ['string', 'str'],
    ['spring', 'spr'],
    ['station', 'stat'],
    ['need', 'ne'],
  ])('leaves %s whole', (word, wrong) => {
    expect(stem(word)).not.toBe(wrong);
  });

  it('keeps different words apart', () => {
    expect(stem('design')).not.toBe(stem('designer'));
    expect(stem('manage')).not.toBe(stem('management'));
    expect(stem('market')).not.toBe(stem('marketplace'));
  });

  it('finds a phrase in its other forms, words still in order', () => {
    const index = phraseIndex(['x:workflow automation', 'x:report generation']);
    expect(phraseMentions('Automated workflows for the finance team.', index)).toEqual([]);
    expect(phraseMentions('Owned workflow automations and generated reports.', index).map((m) => m.id)).toEqual(['x:workflow automation']);
    expect(phraseMentions('Built report generating jobs.', index).map((m) => m.id)).toEqual(['x:report generation']);
  });
});
