import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { createClaudeDirect } from '../src/ai/providers/claudeDirect';
import { createFakeProvider } from '../src/ai/providers/fake';
import { createOpenRouter } from '../src/ai/providers/openrouter';
import { createRecordedProvider } from '../src/ai/providers/recorded';
import { loadConfig } from '../src/config';
import { createEvalGateway } from './gateway';
import { GOLDEN } from './golden';
import { gate, runGolden } from './harness';
import { groundedModel } from './referenceModel';
import { egressHostsFor, setEgressAllowlist } from '../src/net/egress';

/**
 * `pnpm eval` (ImBackendImplementationPlan P9-06). Runs the golden set and applies the bar; exits
 * non-zero below it, which is what blocks a release.
 *
 * - `--reference` (default until recordings exist): the scripted reference model, as unit tests do.
 * - `--recorded`: replays `evals/recordings` (CI, once a live run has recorded them).
 * - `--live`: the direct Claude API (D-23), recording every answer into `evals/recordings`. Synthetic
 *   data only (L4); the per-developer daily cap (AI_DAILY_CAP_USD) stops the run when reached.
 * - `--openrouter`: `--live` through OpenRouter with OPENROUTER_API_KEY (toreview §108), same models,
 *   cap and recordings.
 * - `--only <id,id>` runs a subset; the report is written to `evals/last-report.json`.
 */

const args = process.argv.slice(2);
const viaOpenRouter = args.includes('--openrouter');
const mode = args.includes('--live') || viaOpenRouter ? 'live' : args.includes('--recorded') ? 'recorded' : 'reference';
const only = args[args.indexOf('--only') + 1];
const pairs = args.includes('--only') && only ? GOLDEN.filter((p) => only.split(',').includes(p.id)) : GOLDEN;
const dir = join(import.meta.dirname, 'recordings');

async function main() {
  const config = loadConfig();
  setEgressAllowlist(egressHostsFor(viaOpenRouter ? { ...config, LLM_ROUTE: 'openrouter' } : config));
  let provider;
  if (viaOpenRouter) {
    if (!config.OPENROUTER_API_KEY) throw new Error('An OpenRouter eval needs OPENROUTER_API_KEY in the root .env (toreview §108).');
    provider = createRecordedProvider({ dir, live: createOpenRouter(config.OPENROUTER_API_KEY), record: true });
  } else if (mode === 'live') {
    if (!config.ANTHROPIC_API_KEY) throw new Error('A live eval needs ANTHROPIC_API_KEY in the root .env (D-23).');
    provider = createRecordedProvider({ dir, live: createClaudeDirect(config.ANTHROPIC_API_KEY), record: true });
  } else if (mode === 'recorded') {
    provider = createRecordedProvider({ dir });
  } else {
    provider = createFakeProvider({ script: groundedModel });
  }
  const gateway = createEvalGateway(provider, { developerKey: mode === 'live', dailyCapUsd: config.AI_DAILY_CAP_USD });
  const report = await runGolden({ gateway, pairs });
  const verdict = gate(report);
  // Only live calls on the developer's key are spend; scripted and recorded answers cost nothing.
  const spentUsd = gateway.trace.filter((r) => r.tag === 'dev').reduce((n, r) => n + (r.cost_micros ?? 0), 0) / 1e6;
  writeFileSync(join(import.meta.dirname, 'last-report.json'), `${JSON.stringify({ mode, ...report, verdict, spentUsd }, null, 2)}\n`);
  console.log(`golden ${report.golden} (${mode}, ${pairs.length} pairs, $${spentUsd.toFixed(2)})`);
  console.log(JSON.stringify(report.totals, null, 2));
  console.log(verdict.pass ? 'PASS' : `FAIL\n- ${verdict.failures.join('\n- ')}`);
  process.exitCode = verdict.pass ? 0 : 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
