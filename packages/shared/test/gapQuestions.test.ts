import { describe, expect, it } from 'vitest';

import type { GapQuestion, Profile } from '../src/models/profile';
import { gapChanges, gapQuestionsOf, gapRecord, MAX_GAP_QUESTIONS } from '../src/scoring/gapQuestions';

/** What the interview asks, and what an answer does (toreview §146.7). Synthetic. */

const role = (id: string, over = {}) => ({
  id,
  company: `Co ${id}`,
  title: 'Designer',
  startDate: '2020-01-01',
  endDate: '2021-01-01',
  current: false,
  skills: ['Figma'],
  ...over,
});

const profile = (over: Partial<Profile>): Profile =>
  ({ skills: [], experiences: [], education: [], certifications: [], ...over }) as Profile;

const only = (p: Profile): GapQuestion => {
  const [question] = gapQuestionsOf(p, {});
  if (!question) throw new Error('expected a question');
  return question;
};

describe('gapQuestionsOf', () => {
  it('asks in plain words, naming the role', () => {
    const question = only(profile({ experiences: [role('a', { endDate: undefined })] }));
    expect(question).toMatchObject({
      id: 'role_end:a',
      kind: 'role_end',
      title: 'Are you still at Co a?',
      detail: 'Your Designer role has no end date.',
      roleId: 'a',
    });
  });

  it('names the months of a gap', () => {
    const experiences = [
      role('a', { startDate: '2021-01-01', endDate: '2023-01-01' }),
      role('b', { startDate: '2023-08-01', endDate: '2024-01-01' }),
    ];
    const question = only(profile({ experiences }));
    expect(question.title).toBe('What were you doing from Jan 2023 to Aug 2023?');
    expect(question.id).toBe('date_gap:2023-01:2023-08');
  });

  it('offers the roles a skill could belong to', () => {
    const question = only(profile({ skills: ['Go'], experiences: [role('a')] }));
    expect(question).toMatchObject({ kind: 'skill_home', skill: 'Go', roles: [{ id: 'a', label: 'Designer at Co a' }] });
  });

  it('asks each thing once: an answer or a skip ends it', () => {
    const p = profile({ experiences: [role('a', { endDate: undefined })] });
    expect(gapQuestionsOf(p, { 'role_end:a': 'skip' })).toEqual([]);
    expect(gapQuestionsOf(p, { 'role_end:a': 'answered' })).toEqual([]);
  });

  it('never asks more than seven at a sitting', () => {
    const experiences = Array.from({ length: 12 }, (_, i) => role(String(i), { endDate: undefined }));
    expect(gapQuestionsOf(profile({ experiences }), {})).toHaveLength(MAX_GAP_QUESTIONS);
  });
});

describe('what an answer does', () => {
  const noEnd = profile({ experiences: [role('a', { endDate: undefined })] });

  it('records a role as current, or its end date', () => {
    const question = only(noEnd);
    expect(gapChanges(noEnd, question, { kind: 'role_end', end: null }).experience).toMatchObject({ current: true });
    const ended = gapChanges(noEnd, question, { kind: 'role_end', end: '2022-03-01' }).experience;
    expect(ended).toMatchObject({ current: false, endDate: '2022-03-01' });
  });

  it('adds skills to the role, without repeats', () => {
    const p = profile({ experiences: [role('a', { skills: [] })] });
    const answer = { kind: 'role_skills' as const, skills: ['Figma', 'Figma'] };
    expect(gapChanges(p, only(p), answer).experience?.skills).toEqual(['Figma']);
  });

  it('tags a skill at the role picked, and writes nothing for a course', () => {
    const p = profile({ skills: ['Go'], experiences: [role('a')] });
    const question = only(p);
    expect(gapChanges(p, question, { kind: 'skill_home', roleId: 'a' }).experience?.skills).toEqual(['Figma', 'Go']);
    expect(gapChanges(p, question, { kind: 'skill_home', roleId: null })).toEqual({});
  });

  it('keeps a finished year as a year', () => {
    const p = profile({ education: [{ id: 'e', institution: 'Uni', degree: 'BSc', startDate: '', current: false }] });
    expect(gapChanges(p, only(p), { kind: 'education_year', year: 2019 }).education).toMatchObject({
      endDate: '2019-12-31',
      endPrecision: 'year',
      current: false,
    });
  });

  it('changes no fact for a skip or a gap’s reason, and remembers the reason', () => {
    expect(gapChanges(noEnd, only(noEnd), { kind: 'skip' })).toEqual({});
    expect(gapRecord({ kind: 'skip' })).toBe('skip');
    expect(gapRecord({ kind: 'date_gap', reason: 'study' })).toBe('study');
    expect(gapRecord({ kind: 'role_end', end: null })).toBe('answered');
  });
});
