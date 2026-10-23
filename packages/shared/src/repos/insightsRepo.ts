import { insightsFixture, simulate } from '../mock';

import { clone } from './state';
import type { InsightsRepo } from './types';

/**
 * The web Insights page (461:14). The real service computes these from the account's activity;
 * the mock answers with a fixture per window, so nothing the user does in a session moves them.
 */
export function createMockInsightsRepo(): InsightsRepo {
  return {
    get: (range) => simulate(() => clone(insightsFixture[range])),
  };
}
