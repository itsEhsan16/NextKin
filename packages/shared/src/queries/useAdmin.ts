import { keepPreviousData, useQuery } from '@tanstack/react-query';

import type { AdminRange } from '../models';
import { repos } from '../repos';

import { qk } from './keys';

/**
 * The admin portal (V2 §7.17, Figma 382:936). Read-only in this slice: the Overview and the shell
 * that frames every admin page.
 */

/** The signed-in staff member, and what their role may open. */
export function useAdminMe() {
  return useQuery({ queryKey: qk.admin.me(), queryFn: () => repos.admin.me() });
}

/**
 * The Overview's aggregates for one window. Switching the window keeps the last window's figures
 * on screen until the new ones arrive, so the cards change in place rather than dropping to
 * skeletons.
 */
export function useAdminOverview(range: AdminRange) {
  return useQuery({
    queryKey: qk.admin.overview(range),
    queryFn: () => repos.admin.overview(range),
    placeholderData: keepPreviousData,
  });
}

/** The work queues: the Overview's "Needs attention" and the sidebar's counts. */
export function useAdminQueues() {
  return useQuery({ queryKey: qk.admin.queues(), queryFn: () => repos.admin.queues() });
}

/**
 * The newest audit rows matching a search (action, staff, reason or target). `enabled: false`
 * holds the request, for a role without `audit.read`, which the server would refuse.
 */
export function useAdminActivity(query: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.admin.activity(query.trim().toLowerCase()),
    queryFn: () => repos.admin.activity(query),
    placeholderData: keepPreviousData,
    enabled,
  });
}
