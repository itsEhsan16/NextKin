import type { Route } from 'next';

/**
 * The Resumes page with one resume open: `ResumesRoute` reads `?resume=` and hands it to
 * `ResumesScreen`, the same way `jobHref` opens a job (`toreview.md` §102).
 */
export function resumeHref(id: string): Route {
  return `/resumes?resume=${encodeURIComponent(id)}` as Route;
}

/** The resume editor (toreview §124). */
export function resumeEditorHref(id: string): Route {
  return `/resumes/${encodeURIComponent(id)}/edit` as Route;
}
