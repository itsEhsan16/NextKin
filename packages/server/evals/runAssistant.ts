import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { createModelBrain, createStandInBrain } from '../src/assistant/brain';
import { createClaudeDirect } from '../src/ai/providers/claudeDirect';
import { createOpenRouter } from '../src/ai/providers/openrouter';
import { createRecordedProvider } from '../src/ai/providers/recorded';
import type { LlmProvider } from '../src/ai/types';
import { loadConfig } from '../src/config';
import { egressHostsFor, setEgressAllowlist } from '../src/net/egress';
import { PROMPTS } from '../src/seed/prompts';
import { SCOPE_BAR, scoreScope } from './assistantScope';
import { createEvalGateway } from './gateway';

/**
 * `pnpm eval:assistant` (ImBackendImplementationPlan P11-09): the scope classifier against the
 * labelled set; exits non-zero below 95%.
 *
 * - default: the deterministic stand-in (the keyword matcher local and CI run without a key). It is
 *   reported, not gated: the bar is a claim about the real classifier.
 * - `--recorded`: replays `evals/recordings`.
 * - `--live`: the fast tier through the direct Claude API (D-23), recording each answer. Synthetic
 *   messages only (L4); the daily cap applies.
 * - `--openrouter`: `--live` through OpenRouter with OPENROUTER_API_KEY (toreview §108).
 */
const args = process.argv.slice(2);
const viaOpenRouter = args.includes('--openrouter');
const mode = args.includes('--live') || viaOpenRouter ? 'live' : args.includes('--recorded') ? 'recorded' : 'stand-in';
const dir = join(import.meta.dirname, 'recordings');

const fromSeed = async (name: string) => {
  const prompt = PROMPTS.find((p) => p.name === name);
  if (!prompt) throw new Error(`no seeded prompt "${name}"`);
  return { id: `seed:${name}`, body: prompt.body };
};

function liveProvider(config: ReturnType<typeof loadConfig>): LlmProvider {
  if (viaOpenRouter) {
    if (!config.OPENROUTER_API_KEY) throw new Error('An OpenRouter eval needs OPENROUTER_API_KEY in the root .env (toreview §108).');
    return createOpenRouter(config.OPENROUTER_API_KEY);
  }
  if (!config.ANTHROPIC_API_KEY) throw new Error('A live eval needs ANTHROPIC_API_KEY in the root .env (D-23).');
  return createClaudeDirect(config.ANTHROPIC_API_KEY);
}

async function main() {
  const config = loadConfig();
  setEgressAllowlist(egressHostsFor(viaOpenRouter ? { ...config, LLM_ROUTE: 'openrouter' } : config));
  let brain;
  let gateway;
  if (mode === 'stand-in') {
    brain = createStandInBrain();
  } else {
    const live = mode === 'live' ? liveProvider(config) : null;
    const provider = live ? createRecordedProvider({ dir, live, record: true }) : createRecordedProvider({ dir });
    gateway = createEvalGateway(provider, { developerKey: mode === 'live', dailyCapUsd: config.AI_DAILY_CAP_USD });
    brain = createModelBrain(gateway, fromSeed);
  }
  const report = await scoreScope(brain);
  const gated = mode !== 'stand-in';
  const pass = !gated || report.accuracy >= SCOPE_BAR;
  const spentUsd = (gateway?.trace ?? []).filter((r) => r.tag === 'dev').reduce((n, r) => n + (r.cost_micros ?? 0), 0) / 1e6;
  writeFileSync(join(import.meta.dirname, 'last-assistant-report.json'), `${JSON.stringify({ mode, ...report, bar: SCOPE_BAR, gated, pass, spentUsd }, null, 2)}\n`);
  console.log(`assistant scope (${mode}): ${report.correct}/${report.total} = ${(report.accuracy * 100).toFixed(1)}% (bar ${SCOPE_BAR * 100}%${gated ? '' : ', not gated for the stand-in'}), $${spentUsd.toFixed(2)}`);
  if (report.falseRefusals.length) console.log(`false refusals:\n- ${report.falseRefusals.join('\n- ')}`);
  if (report.falseAccepts.length) console.log(`false accepts:\n- ${report.falseAccepts.join('\n- ')}`);
  console.log(pass ? 'PASS' : 'FAIL');
  process.exitCode = pass ? 0 : 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
