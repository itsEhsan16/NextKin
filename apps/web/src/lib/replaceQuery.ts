/**
 * Writes one query parameter into the address bar without navigating (`toreview.md` §102): the
 * tab a page is on, so a refresh, the Back button or a shared link comes back to it. The native
 * History API, which Next's App Router keeps in step with `useSearchParams`; no re-render, no
 * scroll, no new history entry.
 */
export function replaceQuery(param: string, value: string): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (url.searchParams.get(param) === value) return;
  url.searchParams.set(param, value);
  window.history.replaceState(window.history.state, '', url);
}
