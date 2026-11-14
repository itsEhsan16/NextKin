import { describe, expect, it } from 'vitest';

import type { TailorKeyword } from '../src/models/tailor';
import type { FitPlace } from '../src/scoring/placeFit';
import { initialChoices, tailorRunInput, togglePlace } from '../src/tailor/customize';
import { askable, keywordQuestions, MAX_QUESTIONS, placeLines, questionText, ruleQuestions, type QuestionContext } from '../src/tailor/questions';

/**
 * "Did you use this here?" (toreview §206.3). The promise under test: a question is only ever
 * about a real gap of the job, beside a real line of the resume, and whoever proposed it, code
 * decides whether it is asked. Synthetic resume.
 */

const missing = (label: string, over: Partial<TailorKeyword> = {}): TailorKeyword => ({ label, onResume: false, source: 'required', ...over });

const role: FitPlace = {
  id: 'r1',
  text: ['Backend Engineer', 'Built REST endpoints for the billing service in Node.js', 'Wrote the deployment scripts and ran releases', 'Kept the PostgreSQL schema and its migrations'].join('\n'),
  skills: ['Node.js', 'PostgreSQL'],
  start: { year: 2021, month: 1 },
  end: null,
};
const old: FitPlace = { id: 'r2', text: ['Web Developer', 'Maintained the company website in PHP'].join('\n'), skills: ['PHP'], start: { year: 2009 }, end: { year: 2011 } };
const project: FitPlace = { id: 'project:p1', text: ['Invoice tool', 'A small tool for freelancers', 'Sends invoices by email'].join('\n'), skills: [] };

const ctx = (keywords: TailorKeyword[], over: Partial<QuestionContext> = {}): QuestionContext => ({
  keywords,
  places: [
    { id: 'r1', label: 'Backend Engineer, Kestrel Freight' },
    { id: 'r2', label: 'Web Developer, Old Harbor' },
    { id: 'project:p1', label: 'Invoice tool' },
  ],
  fitPlaces: [role, old, project],
  asOf: { year: 2026, month: 11 },
  ...over,
});

describe('what may be asked about', () => {
  it('only missing skills, and not one a record already backs at a place', () => {
    const keywords = [missing('Docker'), missing('Kafka', { onResume: true }), missing('ownership', { kind: 'soft' }), missing('Redis', { elsewhere: { from: 'profile', shown: 'experience', in: 'x', source: 'your profile', where: 'r1' } }), missing('Terraform', { elsewhere: { from: 'profile', shown: 'listed', in: 'your profile', source: 'your profile' } })];
    expect(askable(keywords).map((k) => k.label)).toEqual(['Docker', 'Terraform']);
  });

  it('reads a place’s lines without its title', () => {
    expect(placeLines(role)).toHaveLength(3);
    expect(placeLines(role)[0]).toBe('Built REST endpoints for the billing service in Node.js');
  });
});

describe('a model’s proposals, as code keeps them', () => {
  const c = ctx([missing('Postman'), missing('Docker'), missing('Kubernetes')]);

  it('keeps a real gap beside a real line, and writes the question itself', () => {
    const [q] = keywordQuestions(c, [{ keyword: 'postman', where: 'r1', line: 0 }]);
    expect(q).toEqual({ keyword: 'Postman', where: 'r1', place: 'Backend Engineer, Kestrel Freight', line: 'Built REST endpoints for the billing service in Node.js', by: 'model' });
    expect(questionText(q!)).toBe('Did you use Postman in Backend Engineer, Kestrel Freight?');
  });

  it.each([
    ['a keyword the job did not ask for', { keyword: 'Rust', where: 'r1', line: 0 }],
    ['a place the resume does not have', { keyword: 'Docker', where: 'r9', line: 0 }],
    ['a line that is not there', { keyword: 'Docker', where: 'r1', line: 7 }],
    ['a line number that is not a whole number', { keyword: 'Docker', where: 'r1', line: 0.5 }],
    ['a negative line', { keyword: 'Docker', where: 'r1', line: -1 }],
  ])('drops %s', (_name, proposal) => {
    expect(keywordQuestions(c, [proposal])).toEqual([]);
  });

  it('drops a technology that did not exist while the role ran', () => {
    expect(keywordQuestions(c, [{ keyword: 'Kubernetes', where: 'r2', line: 0 }])).toEqual([]);
    expect(keywordQuestions(c, [{ keyword: 'Kubernetes', where: 'r1', line: 1 }])).toHaveLength(1);
  });

  it('drops a question whose line already names the keyword', () => {
    const named = ctx([missing('PostgreSQL')]);
    expect(keywordQuestions(named, [{ keyword: 'PostgreSQL', where: 'r1', line: 2 }])).toEqual([]);
  });

  it('asks once a keyword, a few a place, and never more than the cap', () => {
    const many = Array.from({ length: 12 }, (_, i) => missing(`Tool${i}`));
    const proposals = many.flatMap((k, i) => [
      { keyword: k.label, where: i % 2 ? 'r1' : 'project:p1', line: 0 },
      { keyword: k.label, where: 'r1', line: 1 },
    ]);
    const kept = keywordQuestions(ctx(many), proposals);
    expect(new Set(kept.map((q) => q.keyword)).size).toBe(kept.length);
    expect(kept.filter((q) => q.where === 'r1').length).toBeLessThanOrEqual(3);
    expect(kept.length).toBeLessThanOrEqual(MAX_QUESTIONS);
  });

  it('puts the job’s top keywords first', () => {
    const kept = keywordQuestions(ctx([missing('Docker'), missing('Postman', { top: true })]), [
      { keyword: 'Docker', where: 'r1', line: 1 },
      { keyword: 'Postman', where: 'r1', line: 0 },
    ]);
    expect(kept.map((q) => q.keyword)).toEqual(['Postman', 'Docker']);
  });
});

describe('the rules’ own questions', () => {
  it('asks at the place the comparison picked, beside its closest line', () => {
    const c = ctx([missing('deployment automation'), missing('Docker')], { picks: { 'deployment automation': ['r1'], Docker: ['r9'] } });
    expect(ruleQuestions(c)).toEqual([{ keyword: 'deployment automation', where: 'r1', place: 'Backend Engineer, Kestrel Freight', line: 'Wrote the deployment scripts and ran releases', by: 'rules' }]);
  });

  it('asks nothing when no line of the picked place hints at it', () => {
    expect(ruleQuestions(ctx([missing('Figma')], { picks: { Figma: ['r1'] } }))).toEqual([]);
  });

  it('comes before the model’s, which may not ask the same keyword again', () => {
    const c = ctx([missing('deployment automation'), missing('Postman')], { picks: { 'deployment automation': ['r1'] } });
    const kept = keywordQuestions(c, [
      { keyword: 'deployment automation', where: 'project:p1', line: 0 },
      { keyword: 'Postman', where: 'r1', line: 0 },
    ]);
    expect(kept.map((q) => [q.keyword, q.by])).toEqual([
      ['deployment automation', 'rules'],
      ['Postman', 'model'],
    ]);
  });
});

describe('answering', () => {
  const comparison = { resumeId: 'res', jdId: 'jd', score: 60, keywords: [missing('Postman'), missing('Docker')], improvements: [] };

  it('a yes is the candidate’s own word at that place; no answer adds nothing', () => {
    const yes = togglePlace(initialChoices(), 'Postman', 'r1', true);
    expect(tailorRunInput(comparison, yes).tailor).toMatchObject({ added: ['Postman'], skipped: ['Docker'], confirmed: [{ keyword: 'Postman', where: 'r1', by: 'you' }] });
    expect(tailorRunInput(comparison, initialChoices()).tailor).toMatchObject({ added: [], skipped: ['Postman', 'Docker'] });
    expect(tailorRunInput(comparison, initialChoices()).tailor?.confirmed).toBeUndefined();
  });
});
