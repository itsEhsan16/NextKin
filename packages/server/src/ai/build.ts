import type { Config } from '../config';
import type { Database } from '../db/database';
import type { Logger } from '../observability/logger';
import type { DegradedSignal } from '../health/degraded';
import { createAiGateway, type AiGateway, type ProviderRegistry } from './gateway';
import { createClaudeDirect } from './providers/claudeDirect';
import { createFakeProvider } from './providers/fake';
import { createOpenRouter } from './providers/openrouter';
import { createRecordedProvider } from './providers/recorded';
import { createAiSettings } from './routing';
import { createDbTrace } from './trace';
import type { LlmProvider } from './types';

/**
 * The routes that reach a real model. Everything that chooses between the model and a deterministic
 * stand-in (the assistant's brain, the live evals) asks this, so a new route is added once.
 */
export const LIVE_ROUTES = ['claudeDirect', 'openrouter', 'claudeAws'] as const;
export const isLiveRoute = (config: Pick<Config, 'LLM_ROUTE'>): boolean => (LIVE_ROUTES as readonly string[]).includes(config.LLM_ROUTE);

/**
 * Builds the AI gateway for a process from configuration (P6-07, P6-08). LLM_ROUTE decides what
 * the `claude` family means here:
 * - `recorded` (local and CI default): replays fixtures; no credential, no network.
 * - `fake`: deterministic answers.
 * - `claudeDirect`: the developer's own key (D-23), capped per day; with AI_RECORD the answers are
 *   written as fixtures.
 * - `openrouter`: the same models through the developer's OpenRouter key (toreview §108), under the
 *   same cap and recording rules as `claudeDirect`.
 * - `claudeAws`: Claude Platform on AWS, at X-10 (refused until then).
 */
export function buildProviders(config: Config): ProviderRegistry {
  let claude: LlmProvider;
  switch (config.LLM_ROUTE) {
    case 'fake':
      claude = createFakeProvider();
      break;
    case 'recorded':
      claude = createRecordedProvider();
      break;
    case 'claudeDirect': {
      if (!config.ANTHROPIC_API_KEY) throw new Error('LLM_ROUTE=claudeDirect needs ANTHROPIC_API_KEY in .env (D-23).');
      const live = createClaudeDirect(config.ANTHROPIC_API_KEY);
      claude = config.AI_RECORD ? createRecordedProvider({ live, record: true }) : live;
      break;
    }
    case 'openrouter': {
      if (!config.OPENROUTER_API_KEY) throw new Error('LLM_ROUTE=openrouter needs OPENROUTER_API_KEY in .env (toreview §108).');
      const live = createOpenRouter(config.OPENROUTER_API_KEY);
      claude = config.AI_RECORD ? createRecordedProvider({ live, record: true }) : live;
      break;
    }
    case 'claudeAws':
      throw new Error('LLM_ROUTE=claudeAws arrives with Claude Platform on AWS (Connect item X-10).');
  }
  const developerKey = config.LLM_ROUTE === 'claudeDirect' || config.LLM_ROUTE === 'openrouter';
  return {
    resolve: (family) => (family === 'claude' ? claude : null),
    isDeveloperKey: () => developerKey,
  };
}

export function buildAiGateway(config: Config, db: Database, log: Logger, providers: ProviderRegistry = buildProviders(config), signal?: DegradedSignal): AiGateway {
  return createAiGateway({
    ...(signal ? { onAvailability: (available: boolean) => void (available ? signal.clear('ai') : signal.mark('ai')) } : {}),
    settings: createAiSettings(db),
    providers,
    trace: createDbTrace(db, log),
    log,
    developer: config.AI_DEVELOPER,
    dailyCapUsd: config.AI_DAILY_CAP_USD,
  });
}
