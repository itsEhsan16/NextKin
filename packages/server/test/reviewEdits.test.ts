import { factsOfDocument } from '@nextkin/shared/scoring/documentFacts';
import { CANONICAL_SCHEMA_VERSION, canonicalResumeSchema, type CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';
import { describe, expect, it } from 'vitest';

import { redactContact } from '../src/ai/pii';
import { applyReview, type ReviewEdit } from '../src/pipeline/stages/reviewEdits';
import { mergeTailored, type TailorRunInput } from '../src/pipeline/stages/tailorMerge';

/**
 * The AI's review of a tailored resume (toreview §170): the model proposes, code decides. Each edit
 * is applied only when it passes its check. Synthetic resume and people (L4).
 */

const line = (id: string, text: string) => ({ id, text, evidence: [] as string[], origin: 'user' as const });

const BASE: CanonicalResumeJson = {
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  headline: 'Developer',
  summary: line('s0', 'Developer building web apps in Java and React.'),
  header: { name: 'Sam Rivera', items: [{ text: 'Patna, India' }, { text: 'sam@example.com' }, { text: 'Open to relocating to Lucknow' }] },
  skills: ['React', 'Java', 'Spring Boot', 'Git', 'PostgreSQL'].map((name, i) => ({ id: `k${i}`, name, evidence: [], origin: 'user' as const })),
  skillGroups: [
    { label: 'Front End', names: ['React'] },
    { label: 'Back End', names: ['Java', 'Spring Boot'] },
    { label: 'Tools', names: ['Git', 'PostgreSQL'] },
  ],
  roles: [
    {
      roleId: 'intern',
      company: 'Acme Apps',
      title: 'Developer Intern',
      start: '2025-01',
      end: '2025-06',
      skills: ['Java', 'Spring Boot', 'React'],
      bullets: [line('a', 'Built REST APIs in Spring Boot for 12 partner stores'), line('b', 'Built the order screens in React')],
    },
    { roleId: 'shop', company: 'Corner Shop', title: 'Helper', start: '2023-01', end: '2023-12', skills: [], bullets: [line('c', 'Kept the stock list up to date')] },
  ],
  education: [],
  certifications: [],
  projects: [],
  layout: { order: ['summary', 'skills', 'projects', 'experience', 'education', 'certifications'], headings: {} },
};

const request = (patch: Partial<TailorRunInput> = {}): TailorRunInput => ({
  baseResumeId: 'r1',
  baseVersionId: 'v1',
  fixes: ['headline', 'summary', 'skills', 'experience'],
  experience: 'quick',
  added: ['Terraform', 'cloud environments', 'Git & GitHub workflows'],
  skipped: ['Kubernetes'],
  baselineScore: 50,
  ...patch,
});

const setup = (patch: Partial<TailorRunInput> = {}) => {
  const tailor = request(patch);
  const doc = mergeTailored({ base: BASE, generated: BASE, request: tailor, job: { title: 'Java Full Stack Engineer', skills: ['Java', 'Spring Boot'] } });
  const facts = factsOfDocument(BASE, { added: tailor.added, redact: redactContact });
  return { doc, ctx: { base: BASE, facts, tailor, asOf: { year: 2026, month: 11 } } };
};

const edit = (patch: Partial<ReviewEdit> & Pick<ReviewEdit, 'op'>): ReviewEdit => ({ target: null, text: null, evidence: null, order: null, keep: null, reason: 'test', ...patch });
const review = (...edits: ReviewEdit[]) => ({ issues: ['a problem'], edits });
const lines = (doc: CanonicalResumeJson) => (doc.skillGroups ?? []).map((g) => `${g.label}: ${g.names.join(', ')}`);

describe('the review: summary and bullets go through the claim ledger', () => {
  it('takes a summary the facts back, and refuses one naming a left-out keyword', () => {
    const { doc, ctx } = setup();
    const text = 'Java full-stack developer who built REST APIs in Spring Boot and order screens in React.';
    const ok = applyReview(doc, review(edit({ op: 'summary', text, evidence: ['intern'] })), ctx);
    expect(ok.doc.summary?.text).toBe(text);
    expect(ok.record.applied).toHaveLength(1);
    expect(ok.record.issues).toEqual(['a problem']);

    const left = applyReview(doc, review(edit({ op: 'summary', text: 'Java developer who deployed services on Kubernetes.', evidence: ['intern'] })), ctx);
    expect(left.doc.summary?.text).toBe(doc.summary?.text);
    expect(left.record.refused).toHaveLength(1);
  });

  it('leaves a part the user switched off alone', () => {
    const { doc, ctx } = setup({ fixes: ['headline', 'skills'] });
    const out = applyReview(doc, review(edit({ op: 'summary', text: 'Java developer building REST APIs.', evidence: ['intern'] })), ctx);
    expect(out.record.refused).toEqual([{ op: 'summary', target: null, why: 'part_off' }]);
  });

  it('refuses a bullet that drops its number or cites another role', () => {
    const { doc, ctx } = setup();
    const id = doc.roles[0]!.bullets[0]!.id;
    const out = applyReview(
      doc,
      review(
        edit({ op: 'bullet', target: id, text: 'Built REST APIs in Spring Boot for partner stores', evidence: ['intern#r0'] }),
        edit({ op: 'bullet', target: id, text: 'Built REST APIs in Spring Boot for 12 partner stores', evidence: ['shop#r0'] }),
        edit({ op: 'bullet', target: id, text: 'Designed REST APIs in Spring Boot serving 12 partner stores', evidence: ['intern#r0'] }),
      ),
      ctx,
    );
    expect(out.record.refused.map((r) => r.why)).toEqual(['dropped_a_number', 'cites_other']);
    expect(out.doc.roles[0]!.bullets[0]!.text).toBe('Designed REST APIs in Spring Boot serving 12 partner stores');
    expect(canonicalResumeSchema.parse(out.doc)).toEqual(out.doc);
  });
});

describe('the review: skills', () => {
  it('moves a skill to an existing line, never to one that does not exist', () => {
    const { doc, ctx } = setup();
    const out = applyReview(doc, review(edit({ op: 'move_skill', target: 'PostgreSQL', text: 'Back End' }), edit({ op: 'move_skill', target: 'Git', text: 'Version control' })), ctx);
    expect(lines(out.doc)).toContain('Back End: Java, Spring Boot, PostgreSQL');
    expect(out.record.refused).toEqual([{ op: 'move_skill', target: 'Git', why: 'no_such_line' }]);
  });

  it('drops a duplicate or a ticked job phrase, never a real skill the user ticked', () => {
    const { doc, ctx } = setup();
    const out = applyReview(
      doc,
      review(
        edit({ op: 'drop_skill', target: 'Git', keep: 'Git & GitHub workflows' }),
        edit({ op: 'drop_skill', target: 'cloud environments' }),
        edit({ op: 'drop_skill', target: 'Terraform' }),
        edit({ op: 'drop_skill', target: 'React', keep: 'PostgreSQL' }),
      ),
      ctx,
    );
    const listed = out.doc.skills.map((s) => s.name);
    expect(listed).not.toContain('Git');
    expect(listed).not.toContain('cloud environments');
    expect(listed).toEqual(expect.arrayContaining(['Terraform', 'React', 'Git & GitHub workflows']));
    expect(out.record.refused.map((r) => r.why)).toEqual(['real_skill', 'not_a_duplicate']);
  });
});

describe('the review: orders and the header', () => {
  it('reorders sections only by a permutation of what is there', () => {
    const { doc, ctx } = setup();
    const order = ['summary', 'skills', 'experience', 'projects', 'education', 'certifications'];
    const out = applyReview(doc, review(edit({ op: 'order_sections', order }), edit({ op: 'order_sections', order: ['experience'] })), ctx);
    expect(out.doc.layout?.order).toEqual(order);
    expect(out.record.refused.map((r) => r.why)).toEqual(['not_a_permutation']);
  });

  it('flags a header statement without changing it, and never a contact item', () => {
    const { doc, ctx } = setup();
    const out = applyReview(doc, review(edit({ op: 'flag_header', target: '2', reason: 'the job is in Pune' }), edit({ op: 'flag_header', target: '1', reason: 'x' })), ctx);
    expect(out.doc.header).toEqual(BASE.header);
    expect(out.record.headerFlags).toEqual([{ index: 2, text: 'Open to relocating to Lucknow', reason: 'the job is in Pune' }]);
    expect(out.record.refused.map((r) => r.why)).toEqual(['not_a_statement']);
  });
});
