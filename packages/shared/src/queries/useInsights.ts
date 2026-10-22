import { keepPreviousData, useQuery } from '@tanstack/react-query';

import type { InsightsRange } from '../models';
import { repos } from '../repos';

import { qk } from './keys';

/**
 * The Insights page's figures for one window (461:14). Switching the window keeps the last
 * window's figures on screen until the new ones arrive, so the cards change in place rather than
 * dropping to skeletons.
 */
export function useInsights(range: InsightsRange) {
  return useQuery({
    queryKey: qk.insights.range(range),
    queryFn: () => repos.insights.get(range),
    placeholderData: keepPreviousData,
  });
}
