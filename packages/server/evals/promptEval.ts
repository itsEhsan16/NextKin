import type { AiGateway } from '../src/ai/gateway';
import { createFakeProvider } from '../src/ai/providers/fake';
import type { LlmRequest } from '../src/ai/types';
import { createModelBrain } from '../src/assistant/brain';
import { PROMPTS } from '../src/seed/prompts';
import { SCOPE_BAR, SCOPE_SET, scoreScope } from './assistantScope';
import { createEvalGateway } from './gateway';
import { gate, runGolden, seedPrompts } from './harness';
import { groundedModel } from './referenceModel';

/**
 * The evaluation behind a prompt release (ImBackendImplementationPlan P12-03). Runs the eval that
 * covers a template with a candidate system prompt in place of the active one:
 * - jd.extract, resume.generate, resume.revise: the golden set and its gate;
 * - assistant.classify: the scope set at 95%.
 * With a gateway (a live model) the result is real (`live`). Without one the scripted reference
 * model answers (`reference`): it proves the candidate is well-formed and the pipeline holds, not
 * the model's quality, and the evaluation records which it was.
 */

const lastUser = (request: LlmRequest) => {
  const doc = /<document>\n([\s\S]*?)\n<\/document>/.exec(request.messages[0]?.content ?? '')?.[1] ?? '';
  return doc.split('\n\n').filter((l) => l.startsWith('User: ')).at(-1)?.slice(6) ?? '';
};

/** The reference classifier: answers the scope set's labels, as a perfect fast tier would. */
const referenceScope = () => {
  const labels = new Map(SCOPE_SET.map((c) => [c.text, c.inScope]));
  return createFakeProvider({
    script: (request) => (request.output?.name === 'assistant_scope' ? { data: { inScope: labels.get(lastUser(request)) ?? false, topic: labels.get(lastUser(request)) ? 'resume' : 'other' }, stopReason: 'tool_use', text: '' } : undefined),
  });
};

export async function runTemplateEval(template: string, system: string[], gateway: AiGateway | null): Promise<{ pass: boolean; mode: 'reference' | 'live'; report: unknown }> {
  const mode = gateway ? 'live' : 'reference';
  if (template === 'assistant.classify') {
    const g = gateway ?? createEvalGateway(referenceScope());
    const brain = createModelBrain(g, async (name) => {
      const seeded = PROMPTS.find((p) => p.name === name)!;
      return { id: `candidate:${name}`, body: name === template ? { system } : seeded.body };
    });
    const report = await scoreScope(brain);
    return { pass: report.accuracy >= SCOPE_BAR, mode, report: { ...report, bar: SCOPE_BAR } };
  }
  const g = gateway ?? createEvalGateway(createFakeProvider({ script: groundedModel }));
  const report = await runGolden({ gateway: g, prompts: seedPrompts({ [template]: system }) });
  const verdict = gate(report);
  return { pass: verdict.pass, mode, report: { totals: report.totals, golden: report.golden, failures: verdict.failures } };
}
