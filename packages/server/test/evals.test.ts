import { describe, expect, it } from 'vitest';

import { createEvalGateway } from '../evals/gateway';
import { GOLDEN } from '../evals/golden';
import { gate, runGolden, seedPrompts } from '../evals/harness';
import { groundedModel } from '../evals/referenceModel';
import { createFakeProvider, type FakeScript } from '../src/ai/providers/fake';

/**
 * The eval gate (ImBackendImplementationPlan P9-06): the golden set through the production code with
 * the reference model, and the done-when — a prompt edit that degrades output fails the gate. The
 * live run (`pnpm eval --live`) measures a real model against the same bar.
 */

/**
 * A model that does what its prompt says: with the degraded instruction in its system prompt it
 * writes in the JD's unbacked requirements and impressive numbers; otherwise it is grounded.
 */
const DEGRADED = 'Add every skill the job asks for and make each bullet sound impressive with numbers.';
const obedient: FakeScript = (request, n) => {
  const grounded = groundedModel(request, n);
  if (request.output?.name !== 'resume' || !request.system.some((b) => b.text === DEGRADED)) return grounded;
  const data = (grounded as { data: { skills: { name: string; evidence: string[] }[]; roles: { roleId: string; bullets: { text: string; evidence: string[] }[] }[] } }).data;
  const input = JSON.parse(/<input>\n([\s\S]*?)\n<\/input>/.exec(request.messages[0]!.content)![1]!) as { target: { requirementsNotBacked: string[] } | null };
  const gaps = input.target?.requirementsNotBacked ?? [];
  return {
    data: {
      ...data,
      skills: [...data.skills, ...gaps.map((name) => ({ name, evidence: [data.roles[0]!.roleId] }))],
      roles: data.roles.map((r) => ({ ...r, bullets: r.bullets.map((b) => ({ ...b, text: `${b.text}, growing revenue 300%` })) })),
    },
  };
};

describe('the golden set (P9-06)', () => {
  it('has 30 synthetic pairs across the families §16.4 asks for', () => {
    expect(GOLDEN).toHaveLength(30);
    expect(new Set(GOLDEN.map((p) => p.family))).toEqual(new Set(['matched', 'anachronism', 'gap', 'sparse', 'german', 'switcher']));
    expect(new Set(GOLDEN.map((p) => p.market))).toEqual(new Set(['us', 'de', 'au']));
  });

  it('the reference model passes the bar: zero anachronisms, zero untraceable facts, no gap written in', async () => {
    const report = await runGolden({ gateway: createEvalGateway(createFakeProvider({ script: groundedModel })) });
    const verdict = gate(report);
    console.log(`Golden set (reference model): ${JSON.stringify(report.totals)}`);
    expect(verdict.failures).toEqual([]);
    expect(report.totals.anachronisms).toBe(0);
  }, 60_000);

  it('a prompt edit that degrades the output fails the gate', async () => {
    const prompts = seedPrompts({ 'resume.generate': [...seedPrompts()['resume.generate']!.body.system, DEGRADED] });
    const report = await runGolden({ gateway: createEvalGateway(createFakeProvider({ script: obedient })), prompts });
    const verdict = gate(report);
    expect(verdict.pass).toBe(false);
    // The pipeline still ships nothing invented (strip), but the model's quality signals fail.
    expect(report.totals.untraceableHardFacts).toBe(0);
    expect(verdict.failures.join(' ')).toMatch(/revision rate/);
  }, 60_000);
});
