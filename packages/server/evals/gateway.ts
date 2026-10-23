import { PRICES_DEFAULT, ROUTING_DEFAULT } from '../src/ai/defaults';
import { createAiGateway, type AiGateway } from '../src/ai/gateway';
import type { TraceRow } from '../src/ai/trace';
import type { LlmProvider } from '../src/ai/types';
import { createLogger } from '../src/observability/logger';

/**
 * A gateway for the eval harness without a database (P9-06): the seeded routing and prices, and an
 * in-memory trace whose spend still counts toward the developer's daily cap (D-23) for live runs.
 */
export function createEvalGateway(provider: LlmProvider, options: { developerKey?: boolean; dailyCapUsd?: number } = {}): AiGateway & { trace: TraceRow[] } {
  const rows: TraceRow[] = [];
  const gateway = createAiGateway({
    settings: {
      async routeFor(stage) {
        return ROUTING_DEFAULT.stages[stage] ?? ROUTING_DEFAULT.stages.default ?? [];
      },
      async prices() {
        return PRICES_DEFAULT;
      },
    },
    providers: { resolve: (family) => (family === 'claude' ? provider : null), isDeveloperKey: () => options.developerKey === true },
    trace: {
      async record(row) {
        rows.push(row);
      },
      async developerSpendTodayMicros() {
        return rows.reduce((n, r) => n + (r.cost_micros ?? 0), 0);
      },
    },
    log: createLogger('silent', 'eval'),
    developer: 'eval',
    dailyCapUsd: options.dailyCapUsd ?? 0,
    retryDelayMs: () => 0,
  });
  return Object.assign(gateway, { trace: rows });
}
