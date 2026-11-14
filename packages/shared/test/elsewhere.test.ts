import type { ScoringDocument } from '@nextkin/engines/document';
import { describe, expect, it } from 'vitest';

import type { TailorComparison, TailorKeyword } from '../src/models/tailor';
import { alreadyYours, alreadyYoursLine, initialChoices, tailorRunInput, tickKeyword, toggleAll } from '../src/tailor/customize';
import { backedPlaces, elsewhereFor, elsewhereNote, type ElsewhereSource } from '../src/tailor/elsewhere';
import { keywordRowsOf } from '../src/tailor/keywordRows';

/**
 * "You already have this" (toreview §206.3): a missing keyword found in the candidate's own
 * records. Synthetic people and companies throughout.
 */

const contact = { email: true, phone: false, location: false };
const doc = (over: Partial<ScoringDocument>): ScoringDocument => ({ skills: [], roles: [], education: [], contact, ...over });

const profile: ElsewhereSource = {
  from: 'profile',
  label: 'your profile',
  document: doc({
    skills: ['Terraform', 'Figma'],
    roles: [
      { id: 'p1', title: 'Backend Engineer', company: 'Kestrel Freight', start: { year: 2021, month: 3 }, end: null, bullets: ['Ran the Kafka pipelines that feed the pricing service', 'Built internal tools for the dispatch team'], skills: ['PostgreSQL'] },
      { id: 'p2', title: 'Support Analyst', company: 'Old Harbor', start: { year: 2018 }, end: { year: 2020 }, bullets: ['Answered tickets'], skills: ['Zendesk'] },
    ],
  }),
};
const otherResume: ElsewhereSource = {
  from: 'resume',
  label: 'Platform resume',
  document: doc({
    skills: ['GraphQL'],
    roles: [{ id: 'o1', title: 'Backend Engineer', company: 'Kestrel Freight', start: { year: 2021, month: 3 }, end: null, bullets: ['Deployed services on Kubernetes'], skills: [] }],
  }),
};
const roles = [{ id: 'r1', title: 'Backend Engineer', company: 'Kestrel Freight' }];

const missing = (label: string, over: Partial<TailorKeyword> = {}): TailorKeyword => ({ label, onResume: false, source: 'required', ...over });
const find = (keywords: TailorKeyword[], certificates: string[] = []) => elsewhereFor({ keywords, sources: [profile, otherResume], certificates, roles });

describe('a missing keyword in the candidate’s own records', () => {
  it('finds one a profile role shows, names the role, and lines it up with this resume’s role', () => {
    expect(find([missing('Kafka')]).Kafka).toEqual({
      from: 'profile',
      shown: 'experience',
      in: 'Backend Engineer at Kestrel Freight',
      source: 'your profile',
      where: 'r1',
      line: 'Ran the Kafka pipelines that feed the pricing service',
    });
  });

  it('reads a role’s skill tag as that role showing it, with no line to quote', () => {
    const found = find([missing('Postgres')]).Postgres!;
    expect(found).toMatchObject({ from: 'profile', shown: 'experience', where: 'r1' });
    expect(found.line).toBeUndefined();
  });

  it('says so when the role is one this resume leaves out', () => {
    const found = find([missing('Zendesk')]).Zendesk!;
    expect(found).toMatchObject({ shown: 'experience', in: 'Support Analyst at Old Harbor' });
    expect(found.where).toBeUndefined();
    expect(elsewhereNote(found)).toBe('On your profile: Support Analyst at Old Harbor, a role this resume leaves out.');
  });

  it('finds one only another resume shows, and one only a skills list names', () => {
    const found = find([missing('Kubernetes'), missing('Terraform'), missing('GraphQL')]);
    expect(found.Kubernetes).toMatchObject({ from: 'resume', shown: 'experience', source: 'Platform resume', where: 'r1' });
    expect(found.Terraform).toMatchObject({ from: 'profile', shown: 'listed' });
    expect(found.GraphQL).toMatchObject({ from: 'resume', shown: 'listed', in: 'Platform resume' });
    expect(elsewhereNote(found.Terraform!)).toBe('In your profile’s skills, not on this resume.');
    expect(elsewhereNote(found.GraphQL!)).toBe('In the skills of “Platform resume”, not on this resume.');
  });

  it('finds a phrase the taxonomy does not know, as whole words', () => {
    expect(find([missing('internal tools')])['internal tools']).toMatchObject({ shown: 'experience', line: 'Built internal tools for the dispatch team' });
    expect(find([missing('internal toolkit')])['internal toolkit']).toBeUndefined();
  });

  it('a certificate that names it counts, below a role and above a bare list', () => {
    const certs = ['AWS Certified Developer – Associate', 'Certified Kubernetes Administrator', 'HashiCorp Certified: Terraform Associate'];
    const found = find([missing('AWS'), missing('Kubernetes'), missing('Terraform')], certs);
    expect(found.AWS).toEqual({ from: 'certificate', shown: 'certificate', in: 'AWS Certified Developer – Associate', source: 'your certificates' });
    expect(found.Kubernetes).toMatchObject({ shown: 'experience' });
    expect(found.Terraform).toMatchObject({ shown: 'certificate' });
    expect(elsewhereNote(found.AWS!)).toBe('You hold AWS Certified Developer – Associate.');
  });

  it('never claims what no record shows, a keyword already on the resume, or a soft skill', () => {
    const found = find([missing('Rust'), missing('Kafka', { onResume: true }), missing('ownership', { kind: 'soft' })]);
    expect(found).toEqual({});
  });

  it('only a role this resume has becomes a backed place', () => {
    expect(backedPlaces(find([missing('Kafka'), missing('Zendesk'), missing('Terraform')]))).toEqual({ Kafka: ['r1'] });
  });
});

describe('ticking a keyword the records back', () => {
  const found = find([missing('Kafka'), missing('Rust')]);
  const comparison: TailorComparison = {
    resumeId: 'res',
    jdId: 'jd',
    score: 60,
    keywords: [missing('Rust', { top: true }), { ...missing('Kafka'), elsewhere: found.Kafka! }],
    improvements: [],
    picks: { Kafka: ['r9'], Rust: ['r9'] },
    backed: backedPlaces(found),
  };

  it('nothing starts ticked', () => {
    expect(initialChoices().added).toEqual([]);
    expect(alreadyYours(comparison).map((k) => k.label)).toEqual(['Kafka']);
  });

  it('takes the backed place as the user’s own word, over the AI’s pick', () => {
    const c = tickKeyword(initialChoices(), 'Kafka', true, comparison.picks, comparison.backed);
    expect(c.places.Kafka).toEqual({ where: ['r1'], note: '', by: 'you' });
    const other = tickKeyword(initialChoices(), 'Rust', true, comparison.picks, comparison.backed);
    expect(other.places.Rust).toEqual({ where: ['r9'], note: '', by: 'ai' });
  });

  it('starts a run that confirms it at that role, and skips what was not ticked', () => {
    const c = toggleAll(initialChoices(), ['Kafka'], comparison.picks, comparison.backed);
    const run = tailorRunInput(comparison, c);
    expect(run.tailor).toMatchObject({ added: ['Kafka'], skipped: ['Rust'], confirmed: [{ keyword: 'Kafka', where: 'r1', by: 'you' }] });
  });

  it('leads the keyword table, and makes one line for the phone', () => {
    expect(keywordRowsOf(comparison).map((r) => [r.label, Boolean(r.elsewhere)])).toEqual([
      ['Kafka', true],
      ['Rust', false],
    ]);
    expect(alreadyYoursLine(comparison)).toBe('Already on your profile or another resume: Kafka. Tap to add.');
    expect(alreadyYoursLine({ ...comparison, keywords: [missing('Rust')] })).toBeNull();
  });
});
