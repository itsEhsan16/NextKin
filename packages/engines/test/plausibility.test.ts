import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { canonicalJson } from '../src/canonical';
import { KB } from '../src/datasets/kb';
import { TAXONOMY } from '../src/datasets/taxonomy';
import { checkJd, checkResume, MAX_CAREER_YEARS, techAge, yearsCeilings, yearsClaimsIn, type ResumeRole } from '../src/plausibility';
import { requirementsFromJd } from '../src/requirements';
import { score } from '../src/rubric';
import { approvedKb, AS_OF, backendInput } from './fixtures/documents';

const APPROVED = approvedKb();
const jd = (rawText: string, requiredSkills: string[]) => requirementsFromJd({ requiredSkills, preferredSkills: [], rawText }, TAXONOMY);
const role = (id: string, start: [number, number], end: [number, number] | null, skills: string[] = []): ResumeRole => ({
  id,
  start: { year: start[0], month: start[1] },
  end: end === null ? null : { year: end[0], month: end[1] },
  skills,
});
const resume = (roles: ResumeRole[], extra: { text?: string; statedTotalYears?: number } = {}, kb = APPROVED) =>
  checkResume({ roles, kb, taxonomy: TAXONOMY, asOf: AS_OF, ...extra });

describe('JD asks', () => {
  it('flags 20 years of React: React shipped in 2013, so 13 is the most anyone has', () => {
    const report = checkJd({ requirements: jd('You have 20+ years of experience with React.', ['React']), kb: APPROVED, asOf: AS_OF });
    expect(report.findings).toEqual([
      expect.objectContaining({ code: 'jd_years_exceed_tech_age', severity: 'impossible', subject: 'React', skillId: 'react', requirementId: 'req:react', basis: { yearsAsked: 20, releaseYear: 2013, maxYears: 13 } }),
    ]);
    expect(report.counts).toEqual({ impossible: 1, suspect: 0 });
  });

  it('accepts an ask equal to the technology’s age', () => {
    expect(checkJd({ requirements: jd('13 years of experience with React.', ['React']), kb: APPROVED, asOf: AS_OF }).findings).toEqual([]);
  });

  it('a machine-generated KB entry only flags it as suspect (§105.15)', () => {
    const [finding] = checkJd({ requirements: jd('20 years of experience with React.', ['React']), kb: KB, asOf: AS_OF }).findings;
    expect(finding).toMatchObject({ code: 'jd_years_exceed_tech_age', severity: 'suspect' });
  });

  it('more years than a career holds is impossible even without a KB entry', () => {
    const [finding] = checkJd({ requirements: jd('Senior role.', ['45 years Blorbtech']), kb: APPROVED, asOf: AS_OF }).findings;
    expect(finding).toMatchObject({ code: 'jd_years_implausible', severity: 'impossible', basis: { yearsAsked: 45, maxYears: MAX_CAREER_YEARS } });
  });

  it('a technology the KB does not know is never guessed at', () => {
    expect(checkJd({ requirements: jd('Senior role.', ['30 years Blorbtech']), kb: APPROVED, asOf: AS_OF }).findings).toEqual([]);
  });

  it('caps the years ask at the technology’s age, and leaves fair asks alone', () => {
    const requirements = jd('20 years of experience with React. 5 years of experience with Go.', ['React', 'Go']);
    expect(yearsCeilings(requirements, APPROVED, AS_OF)).toEqual({ react: 13 });
  });
});

describe('resume claims', () => {
  it('flags a summary claiming more years of a technology than it has existed', () => {
    const report = resume([], { text: 'Engineer with 15 years of Kubernetes and 5 years of Go.' });
    expect(report.findings).toEqual([expect.objectContaining({ code: 'claim_years_exceed_tech_age', subject: 'Kubernetes', basis: { yearsAsked: 15, releaseYear: 2014, maxYears: 12 } })]);
  });

  it('reports each skill once', () => {
    expect(resume([], { text: '15 years of Kubernetes. 14 years of Kubernetes.' }).findings).toHaveLength(1);
  });

  it('dates that run backwards or start in the future are impossible', () => {
    const report = resume([role('back', [2020, 5], [2019, 1]), role('future', [2027, 1], null)]);
    expect(report.findings.map((f) => [f.code, f.roleId, f.severity])).toEqual([
      ['end_before_start', 'back', 'impossible'],
      ['start_in_future', 'future', 'impossible'],
    ]);
    expect(report.findings[0]!.basis).toEqual({ start: '2020-05', end: '2019-01' });
  });

  it('reports the timeline engine’s before-release verdicts, approved or not', () => {
    const roles = [role('old', [2008, 1], [2012, 6], ['Kubernetes'])];
    expect(resume(roles).findings[0]).toMatchObject({ code: 'role_before_release', severity: 'impossible', skillId: 'kubernetes', basis: { releaseYear: 2014, end: '2012' } });
    expect(resume(roles, {}, KB).findings[0]).toMatchObject({ code: 'role_before_release', severity: 'suspect' });
  });

  it('a stated total well past the dated roles is suspect; a year of slack is not', () => {
    const roles = [role('a', [2020, 10], [2024, 10])];
    expect(resume(roles, { statedTotalYears: 5 }).findings).toEqual([]);
    expect(resume(roles, { statedTotalYears: 8 }).findings).toEqual([
      expect.objectContaining({ code: 'stated_total_exceeds_roles', severity: 'suspect', basis: { yearsAsked: 8, shownMonths: 48 } }),
    ]);
  });

  it('a clean resume has no findings', () => {
    expect(resume([role('a', [2016, 1], null, ['Go', 'React'])], { text: '6 years of Go.', statedTotalYears: 10 }).findings).toEqual([]);
  });
});

describe('edges', () => {
  it('skips eligibility rows and asks without years; caps an unknown technology at a career', () => {
    const requirements = jd('Must be authorized to work in the EU. Experience with Go.', ['Go', '45 years Blorbtech']);
    expect(checkJd({ requirements, kb: APPROVED, asOf: AS_OF }).findings.map((f) => f.code)).toEqual(['jd_years_implausible']);
    expect(yearsCeilings(requirements, APPROVED, AS_OF)).toEqual({ 'x:blorbtech': MAX_CAREER_YEARS });
  });

  it('names a role by its label, and reports what dates it has', () => {
    const labelled = { ...role('r', [2027, 1], null), label: 'Engineer at Acme' };
    const undated: ResumeRole = { id: 'u', end: null, skills: [] };
    const [finding] = resume([labelled, undated]).findings;
    expect(finding).toMatchObject({ subject: 'Engineer at Acme', basis: { start: '2027-01' } });
  });

  it('orders findings of one code by subject, then role', () => {
    const roles = [role('b', [2021, 1], [2020, 1]), role('a', [2021, 1], [2020, 1]), { ...role('c', [2021, 1], [2020, 1]), label: 'a' }];
    expect(resume(roles).findings.map((f) => f.roleId)).toEqual(['a', 'c', 'b']);
  });

  it('a technology without a KB entry in a role is left to the review queue', () => {
    expect(resume([role('r', [2001, 1], [2003, 1], ['Blorbtech'])]).findings).toEqual([]);
  });
});

describe('helpers and invariants', () => {
  it('reads the skill out of "N years of X"', () => {
    expect(yearsClaimsIn('8+ years of experience with PostgreSQL, and 3 years in Blorbtech', TAXONOMY).map((c) => [c.years, c.skill.id])).toEqual([[8, 'postgresql']]);
  });

  it('techAge is undefined for a technology outside the KB', () => {
    expect(techAge(APPROVED, 'x:blorbtech', AS_OF)).toBeUndefined();
  });

  it('never flags an ask within the technology’s age', () => {
    const ids = APPROVED.entries.map((e) => e.skillId).filter((id) => TAXONOMY.skills.some((s) => s.id === id));
    fc.assert(
      fc.property(fc.constantFrom(...ids), fc.nat({ max: 40 }), (id, offset) => {
        const age = techAge(APPROVED, id, AS_OF)!;
        const years = Math.min(age.maxYears, offset);
        const skill = { id, name: id, known: true };
        return checkJd({ requirements: [{ id: `req:${id}`, kind: 'skill', importance: 'required', text: id, skill, minYears: years }], kb: APPROVED, asOf: AS_OF }).findings.length === 0;
      }),
    );
  });

  it('the report does not depend on the order of the roles', () => {
    const roles = [role('back', [2020, 5], [2019, 1]), role('old', [2008, 1], [2012, 6], ['Kubernetes']), role('future', [2027, 1], null)];
    expect(canonicalJson(resume(roles))).toBe(canonicalJson(resume([...roles].reverse())));
  });
});

describe('scoring an impossible ask (rubric-2)', () => {
  const text = '20+ years of experience with Go.';
  const input = (rubricId: string) => backendInput({ rubricId, jd: { requirements: jd(text, ['Go']), text, completeness: 'full' } });
  const go = (rubricId: string) => score(input(rubricId)).ledger.find((e) => e.skillId === 'go')!;

  it('measures the ask against the technology’s age, and says so', () => {
    // Go shipped in 2009: 17 years is the ceiling; the profile shows Go from 2020-03, about 6.5.
    expect(go('rubric-2').years).toEqual({ asked: 20, shownMonths: 79, capped: 17 });
    expect(go('rubric-1').years).toEqual({ asked: 20, shownMonths: 79 });
  });

  it('never makes a fair ask easier', () => {
    const fair = '5+ years of experience with Go.';
    const at = (rubricId: string) => score(backendInput({ rubricId, jd: { requirements: jd(fair, ['Go']), text: fair, completeness: 'full' } })).ledger[0]!;
    expect(at('rubric-2')).toEqual(at('rubric-1'));
  });
});
