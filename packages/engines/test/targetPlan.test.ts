import { describe, expect, it } from 'vitest';

import type { ScoringDocument } from '../src/document';
import { requirementsFromJd } from '../src/requirements';
import { scoreCore, type ScoreInput } from '../src/rubric';
import { TAXONOMY } from '../src/datasets/taxonomy';
import { planToTarget, type PathStep } from '../src/targetPlan';
import { approvedKb, backendInput, BACKEND_JD_TEXT, BACKEND_REQUIREMENTS, CLEAN_FORMAT } from './fixtures/documents';

const TARGET = 8500;

/** A thin resume: short summary, few skills, no figures, no education, against the backend JD. */
const THIN: ScoringDocument = {
  summary: 'Backend developer.',
  skills: ['Go'],
  roles: [
    {
      id: 'r_now',
      title: 'Backend Developer',
      company: 'Lumen Pay',
      start: { year: 2018, month: 1 },
      end: null,
      skills: ['Go', 'Docker'],
      bullets: ['Built payment services in Go', 'Ran services on Docker', 'Reviewed pull requests'],
    },
    { id: 'r_old', title: 'Developer', company: 'Cartwheel', start: { year: 2015, month: 1 }, end: { year: 2017, month: 12 }, skills: ['Python'], bullets: ['Wrote order APIs'] },
  ],
  education: [],
  contact: { email: true, phone: false, location: false },
};

const thinInput = (overrides: Partial<ScoreInput> = {}): ScoreInput =>
  backendInput({ document: THIN, profile: THIN, format: { ...CLEAN_FORMAT, singleColumn: false }, ...overrides });

/** Every step applied by hand, then one plain re-score: what the path's last total must equal. */
function rescoreAll(input: ScoreInput, steps: readonly PathStep[]): number {
  let document = input.document;
  let profile = input.profile;
  const passedSections = new Set<never>();
  const passedFormat = new Set<never>();
  const removedClaims = new Set<string>();
  const addSkill = (doc: ScoringDocument, name: string, roleId: string | null): ScoringDocument => ({
    ...doc,
    skills: doc.skills.includes(name) ? doc.skills : [...doc.skills, name],
    roles: doc.roles.map((r) => (r.id === roleId ? { ...r, skills: [...(r.skills ?? []), name] } : r)),
  });
  for (const { action: a } of steps) {
    if (a.type === 'confirm_skill') {
      document = addSkill(document, a.skillName, a.roleId);
      profile = profile && addSkill(profile, a.skillName, a.roleId);
    } else if (a.type === 'add_figure') {
      document = { ...document, roles: document.roles.map((r) => (r.id === a.roleId ? { ...r, bullets: r.bullets.map((b, i) => (i === a.bulletIndex ? `${b} (1)` : b)) } : r)) };
    } else if (a.type === 'pass_section') (passedSections as Set<string>).add(a.check);
    else if (a.type === 'pass_format') (passedFormat as Set<string>).add(a.check);
    else removedClaims.add(`${a.roleId}\u0000${a.skillId}`);
  }
  return scoreCore({ ...input, document, ...(profile ? { profile } : {}) }, { passedSections, passedFormat, removedClaims }).totalBps!;
}

describe('the path to a target (§129)', () => {
  it('a thin resume can reach 8.5 when the user accepts the steps', () => {
    const path = planToTarget(thinInput(), { targetBps: TARGET, aiCan: { format: ['singleColumn'], sections: ['summary'] } })!;
    expect(path.startBps).toBeLessThan(TARGET);
    expect(path.reachesTarget).toBe(true);
    expect(path.ceilingBps).toBeGreaterThanOrEqual(TARGET);
    expect(path.stepsToTarget).toBeGreaterThan(0);
    expect(path.steps[path.stepsToTarget! - 1]!.totalAfterBps).toBeGreaterThanOrEqual(TARGET);
    if (path.stepsToTarget! > 1) expect(path.steps[path.stepsToTarget! - 2]!.totalAfterBps).toBeLessThan(TARGET);
  });

  it('the last total is exactly a plain re-score of every step applied', () => {
    const input = thinInput();
    const path = planToTarget(input, { targetBps: TARGET, aiCan: { format: ['singleColumn'], sections: ['summary'] } })!;
    expect(rescoreAll(input, path.steps)).toBe(path.ceilingBps);
    // Totals only rise, and each gain is the difference it made.
    let previous = path.startBps;
    for (const step of path.steps) {
      expect(step.gainBps).toBe(step.totalAfterBps - previous);
      expect(step.gainBps).toBeGreaterThan(0);
      previous = step.totalAfterBps;
    }
  });

  it('the AI’s own steps come first and are the ones the caller named', () => {
    const path = planToTarget(thinInput(), { targetBps: TARGET, aiCan: { format: ['singleColumn'], sections: ['summary'] } })!;
    const firstYours = path.steps.findIndex((s) => s.who === 'you');
    expect(path.steps.slice(0, firstYours).map((s) => s.id)).toEqual(['section:summary', 'format:singleColumn']);
    expect(path.steps.slice(firstYours).every((s) => s.who === 'you')).toBe(true);
    expect(path.aiBps).toBe(path.steps[firstYours - 1]!.totalAfterBps);
  });

  it('a skill is only ever a step the user confirms; it never lands without one', () => {
    const path = planToTarget(thinInput(), { targetBps: TARGET })!;
    const skills = path.steps.filter((s) => s.action.type === 'confirm_skill');
    expect(skills.length).toBeGreaterThan(0);
    expect(skills.every((s) => s.who === 'you')).toBe(true);
    expect(skills.find((s) => s.id === 'skill:req:kafka')!.action).toMatchObject({ roleId: 'r_now', from: 'gap' });
  });

  it('years the roles don’t show cap the ceiling, and say so', () => {
    const text = '12+ years of experience with Go and PostgreSQL. Kafka is required.';
    const requirements = requirementsFromJd({ requiredSkills: ['Go', 'PostgreSQL', 'Kafka'], preferredSkills: [], rawText: text }, TAXONOMY);
    // Go shows from 2018; PostgreSQL, once the user confirms it at that role, as long. Both short of 12.
    const after = planToTarget(thinInput({ jd: { requirements, text, completeness: 'full' } }), { targetBps: TARGET })!;
    expect(after.blockers.map((b) => [b.skillName, b.askedYears])).toEqual([['Go', 12], ['PostgreSQL', 12]]);
    expect(after.ceilingBps).toBeLessThan(10_000);
  });

  it('an impossible years ask is a blocker at its ceiling, not as written (rubric-2)', () => {
    const text = '30+ years of experience with Go.';
    const requirements = requirementsFromJd({ requiredSkills: ['Go'], preferredSkills: [], rawText: text }, TAXONOMY);
    const path = planToTarget(backendInput({ jd: { requirements, text, completeness: 'full' }, kb: approvedKb() }), { targetBps: TARGET })!;
    expect(path.blockers[0]).toMatchObject({ skillName: 'Go', askedYears: 17 });
  });

  it('a resume already past the target needs no step', () => {
    const path = planToTarget(backendInput(), { targetBps: TARGET })!;
    expect(path.startBps).toBeGreaterThanOrEqual(TARGET);
    expect(path.stepsToTarget).toBe(0);
  });

  it('a target out of reach says null steps, with the ceiling as the truth', () => {
    const path = planToTarget(thinInput(), { targetBps: 10_001 })!;
    expect(path.reachesTarget).toBe(false);
    expect(path.stepsToTarget).toBeNull();
  });

  it('a timeline flag is the user’s to resolve', () => {
    const doc: ScoringDocument = { ...THIN, roles: [...THIN.roles, { id: 'r_2010', title: 'Dev', company: 'Old', start: { year: 2009, month: 1 }, end: { year: 2012, month: 1 }, skills: ['Kubernetes'], bullets: ['Shipped 3 releases'] }] };
    const path = planToTarget(thinInput({ document: doc, profile: doc, kb: approvedKb() }), { targetBps: TARGET })!;
    expect(path.steps.find((s) => s.id === 'timeline:r_2010:kubernetes')).toMatchObject({ who: 'you' });
  });

  it('with no dated role, a skill is confirmed into the skills list; without a profile, the document alone', () => {
    const undated: ScoringDocument = { ...THIN, roles: [{ ...THIN.roles[0]!, start: undefined, end: undefined }] };
    const path = planToTarget(thinInput({ document: undated, profile: undefined }), { targetBps: TARGET })!;
    expect(path.steps.find((s) => s.id === 'skill:req:kafka')!.action).toMatchObject({ roleId: null });
    expect(rescoreAll(thinInput({ document: undated, profile: undefined }), path.steps)).toBe(path.ceilingBps);
  });

  it('picks the latest role: current first, then the later start; a profile without that role lists it', () => {
    const roles = [
      { ...THIN.roles[1]!, id: 'r_a', end: null, start: { year: 2016, month: 1 } },
      { ...THIN.roles[0]!, id: 'r_b', end: null, start: { year: 2019, month: 1 } },
      { ...THIN.roles[1]!, id: 'r_c', end: undefined },
    ];
    const doc = { ...THIN, roles };
    const path = planToTarget(thinInput({ document: doc, profile: THIN }), { targetBps: TARGET })!;
    expect(path.steps.find((s) => s.id === 'skill:req:kafka')!.action).toMatchObject({ roleId: 'r_b' });
  });

  it('no path without a JD (D-15)', () => {
    expect(planToTarget(backendInput({ jd: undefined }), { targetBps: TARGET })).toBeUndefined();
  });

  it('the same input gives the same path', () => {
    const run = () => planToTarget(thinInput(), { targetBps: TARGET, aiCan: { sections: ['summary'] } });
    expect(run()).toEqual(run());
  });
});

// Keep the fixture import honest: the thin resume is measured against the same JD as the others.
expect(BACKEND_REQUIREMENTS.length).toBeGreaterThan(0);
expect(BACKEND_JD_TEXT).toContain('Kafka');
