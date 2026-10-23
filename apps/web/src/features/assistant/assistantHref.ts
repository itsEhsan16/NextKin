import type { Route } from 'next';

/**
 * The assistant with something already attached (`toreview.md` §102): the job a "Tailor with AI"
 * came from, or the resume an ATS score is about. `AssistantRoute` reads the parameter and the
 * screen attaches the item once it has loaded.
 */
export function assistantHref(about?: { job?: string; resume?: string }): Route {
  if (about?.job) return `/assistant?job=${encodeURIComponent(about.job)}` as Route;
  if (about?.resume) return `/assistant?resume=${encodeURIComponent(about.resume)}` as Route;
  return '/assistant' as Route;
}
