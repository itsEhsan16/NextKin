import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { createOpenRouter } from '../src/ai/providers/openrouter';
import { createClaudeDirect } from '../src/ai/providers/claudeDirect';
import { createRecordedProvider } from '../src/ai/providers/recorded';
import { loadConfig } from '../src/config';
import { egressHostsFor, setEgressAllowlist } from '../src/net/egress';
import { createEvalGateway } from './gateway';
import { JD_GOLDEN } from './jdGolden';
import { jdGate, runJdGolden } from './jdHarness';

/**
 * `pnpm eval:jd` (toreview §153): the structured reading against the hand-labelled postings.
 * `--openrouter` or `--live` call a real model (recording each answer); `--recorded` replays them.
 * A scripted model can't read pay or years, so this set is measured on a real one. `--only a,b`
 * runs a subset; the report goes to `evals/last-jd-report.json`.
 */
const args = process.argv.slice(2);
const viaOpenRouter = args.includes('--openrouter');
const live = viaOpenRouter || args.includes('--live');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1]?.split(',') : undefined;
const dir = join(import.meta.dirname, 'recordings');

async function main() {
  const config = loadConfig();
  setEgressAllowlist(egressHostsFor(viaOpenRouter ? { ...config, LLM_ROUTE: 'openrouter' } : config));
  let provider;
  if (viaOpenRouter) {
    if (!config.OPENROUTER_API_KEY) throw new Error('needs OPENROUTER_API_KEY in the root .env');
    provider = createRecordedProvider({ dir, live: createOpenRouter(config.OPENROUTER_API_KEY), record: true });
  } else if (live) {
    if (!config.ANTHROPIC_API_KEY) throw new Error('needs ANTHROPIC_API_KEY in the root .env');
    provider = createRecordedProvider({ dir, live: createClaudeDirect(config.ANTHROPIC_API_KEY), record: true });
  } else {
    provider = createRecordedProvider({ dir });
  }
  const gateway = createEvalGateway(provider, { developerKey: live, dailyCapUsd: config.AI_DAILY_CAP_USD });
  const cases = only ? JD_GOLDEN.filter((c) => only.includes(c.id)) : JD_GOLDEN;
  const report = await runJdGolden(gateway, cases);
  const verdict = jdGate(report);
  const spentUsd = gateway.trace.filter((r) => r.tag === 'dev').reduce((n, r) => n + (r.cost_micros ?? 0), 0) / 1e6;
  writeFileSync(join(import.meta.dirname, 'last-jd-report.json'), `${JSON.stringify({ mode: live ? 'live' : 'recorded', ...report, verdict, spentUsd }, null, 2)}\n`);
  const failed = report.checks.filter((c) => !c.pass);
  console.log(`${report.golden}: ${report.cases} postings, ${report.checks.length} checks, ${(report.passRate * 100).toFixed(1)}% pass ($${spentUsd.toFixed(3)})`);
  for (const f of failed) console.log(`  ✗ ${f.caseId} ${f.check} — ${f.detail ?? ''}`);
  console.log(verdict.pass ? 'PASS' : `FAIL\n- ${verdict.failures.join('\n- ')}`);
  process.exitCode = verdict.pass ? 0 : 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
