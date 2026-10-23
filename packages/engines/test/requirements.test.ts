import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { TAXONOMY } from '../src/datasets/taxonomy';
import { evidenceOf } from '../src/document';
import { rubricById } from '../src/provenance';
import { buildLedger, requirementsFromJd, type Evidence } from '../src/requirements';
import { AS_OF, BACKEND_JD_TEXT, BACKEND_RESUME } from './fixtures/documents';

const rubric = rubricById();
const ledger = (requirements: ReturnType<typeof requirementsFromJd>, evidence: Evidence, backing?: Evidence) =>
  buildLedger({ requirements, evidence, rubric, asOf: AS_OF, ...(backing ? { backing } : {}) });
const dated = (id: string, skills: string[], from: number, to: number | null) => ({
  id,
  start: { year: from, month: 1 },
  end: to === null ? null : { year: to, month: 1 },
  skills,
});

describe('typed requirements from a JD', () => {
  it('resolves each skill once, required over preferred, with years and source spans', () => {
    const reqs = requirementsFromJd(
      { requiredSkills: ['Go', 'Postgres', 'Go'], preferredSkills: ['PostgreSQL', 'Terraform'], tools: ['Docker'], rawText: BACKEND_JD_TEXT },
      TAXONOMY,
    );
    const skills = reqs.filter((r) => r.kind === 'skill');
    expect(skills.map((r) => [r.id, r.importance])).toEqual([
      ['req:go', 'required'],
      ['req:postgresql', 'required'],
      ['req:terraform', 'preferred'],
      ['req:docker', 'preferred'],
    ]);
    expect(skills[0]!.minYears).toBe(5);
    expect(BACKEND_JD_TEXT.slice(skills[0]!.span!.start, skills[0]!.span!.end)).toBe('Go');
  });

  it('reads years written into the item itself', () => {
    const [req] = requirementsFromJd({ requiredSkills: ['3+ years Python'], preferredSkills: [] }, TAXONOMY);
    expect(req).toMatchObject({ id: 'req:python', minYears: 3 });
  });

  it('turns eligibility sentences into flags', () => {
    const reqs = requirementsFromJd({ requiredSkills: [], preferredSkills: [], rawText: BACKEND_JD_TEXT }, TAXONOMY);
    expect(reqs.map((r) => r.eligibility)).toEqual(['work_authorization', 'language']);
  });
});

describe('the ledger', () => {
  const reqs = requirementsFromJd({ requiredSkills: ['Go', 'Kafka', 'Docker'], preferredSkills: ['Redis'] }, TAXONOMY);

  it('orders evidence tiers: demonstrated > listed > unbacked (D-14)', () => {
    const evidence: Evidence = { roles: [dated('r', ['go'], 2018, null)], listed: ['go', 'docker'] };
    const result = ledger(reqs, evidence);
    const by = Object.fromEntries(result.entries.map((e) => [e.skillId, e]));
    expect([by.go!.tier, by.docker!.tier, by.kafka!.tier]).toEqual(['demonstrated', 'listed', 'unbacked']);
    expect([by.go!.status, by.docker!.status, by.kafka!.status]).toEqual(['met', 'partial', 'gap']);
    expect(by.go!.creditBps! > by.docker!.creditBps! && by.docker!.creditBps! > by.kafka!.creditBps!).toBe(true);
  });

  it('reads "5+ years" against three computed years as partial', () => {
    const five = requirementsFromJd({ requiredSkills: ['5+ years Go'], preferredSkills: [] }, TAXONOMY);
    const three = ledger(five, { roles: [dated('r', ['go'], 2023, 2026)], listed: [] }).entries[0]!;
    expect(three).toMatchObject({ status: 'partial', years: { asked: 5, shownMonths: 36 } });
    const enough = ledger(five, { roles: [dated('a', ['go'], 2018, 2021), dated('b', ['go'], 2020, 2024)], listed: [] }).entries[0]!;
    expect(enough).toMatchObject({ status: 'met', years: { asked: 5, shownMonths: 72 } });
  });

  it('counts overlapping roles once when computing years', () => {
    const five = requirementsFromJd({ requiredSkills: ['5+ years Go'], preferredSkills: [] }, TAXONOMY);
    const entry = ledger(five, { roles: [dated('a', ['go'], 2020, 2024), dated('b', ['go'], 2021, 2023)], listed: [] }).entries[0]!;
    expect(entry.years!.shownMonths).toBe(48);
  });

  it('ranks required gaps above preferred ones', () => {
    const none: Evidence = { roles: [], listed: [] };
    const missRequired = ledger(reqs, { roles: [dated('r', ['redis'], 2018, null)], listed: [] }).matchBps!;
    const missPreferred = ledger(reqs, { roles: [dated('r', ['go', 'kafka', 'docker'], 2018, null)], listed: [] }).matchBps!;
    expect(missPreferred).toBeGreaterThan(missRequired);
    expect(ledger(reqs, none).matchBps).toBe(0);
  });

  it('eligibility never moves points', () => {
    const withElig = requirementsFromJd({ requiredSkills: ['Go'], preferredSkills: [], rawText: 'Must be authorized to work in the US.' }, TAXONOMY);
    const without = requirementsFromJd({ requiredSkills: ['Go'], preferredSkills: [] }, TAXONOMY);
    const evidence: Evidence = { roles: [dated('r', ['go'], 2018, null)], listed: [] };
    expect(ledger(withElig, evidence).matchBps).toBe(ledger(without, evidence).matchBps);
    expect(ledger(withElig, evidence).entries.find((e) => e.kind === 'eligibility')!.status).toBe('eligibility');
  });

  it('a skill the document shows but the profile does not back earns only what the profile backs', () => {
    const doc: Evidence = { roles: [dated('r', ['go', 'kafka'], 2018, null)], listed: [] };
    const profile: Evidence = { roles: [dated('r', ['go'], 2018, null)], listed: [] };
    const kafka = ledger(reqs, doc, profile).entries.find((e) => e.skillId === 'kafka')!;
    expect(kafka).toMatchObject({ tier: 'unbacked', status: 'gap', creditBps: 0 });
  });

  it('is invariant to repetition and to order', () => {
    const base = ledger(reqs, { roles: [dated('r', ['go', 'docker'], 2018, null)], listed: ['redis'] }).matchBps;
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), fc.boolean(), (times, reverse) => {
        const skills = Array.from({ length: times }, () => ['go', 'docker']).flat();
        const listed = Array.from({ length: times }, () => 'redis');
        const roles = [dated('r', reverse ? [...skills].reverse() : skills, 2018, null), dated('z', [], 2010, 2011)];
        return ledger(reqs, { roles: reverse ? [...roles].reverse() : roles, listed }).matchBps === base;
      }),
    );
  });

  it('reports the JD’s wording when the resume names the skill differently', () => {
    const pg = requirementsFromJd({ requiredSkills: ['PostgreSQL'], preferredSkills: [] }, TAXONOMY);
    const { evidence } = evidenceOf({ ...BACKEND_RESUME, skills: ['Postgres'], roles: [] }, TAXONOMY);
    expect(ledger(pg, evidence).entries[0]!.wording).toEqual({ jd: 'PostgreSQL', resume: 'Postgres' });
  });

  it('text copied from the JD earns nothing', () => {
    const jd = 'You will build reliable payment services in Go and operate them on Kubernetes for millions of merchants.';
    const reqs2 = requirementsFromJd({ requiredSkills: ['Go', 'Kubernetes'], preferredSkills: [], rawText: jd }, TAXONOMY);
    const pasted = { ...BACKEND_RESUME, skills: [], roles: [{ id: 'r', title: 'Engineer', company: 'X', start: { year: 2018 }, end: null, bullets: ['Build reliable payment services in Go and operate them on Kubernetes for millions of merchants'] }] };
    const own = { ...pasted, roles: [{ ...pasted.roles[0]!, bullets: ['Ran settlement services in Go on Kubernetes'] }] };
    const copied = evidenceOf(pasted, TAXONOMY, { jdText: jd, minCopiedWords: rubric.pastedMinWords });
    expect(copied.copied).toHaveLength(1);
    expect(ledger(reqs2, copied.evidence).matchBps).toBe(0);
    expect(ledger(reqs2, evidenceOf(own, TAXONOMY, { jdText: jd, minCopiedWords: rubric.pastedMinWords }).evidence).matchBps).toBe(10_000);
  });
});
