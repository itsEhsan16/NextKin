import type { Route } from 'next';

/**
 * A job description's own page (toreview §110): what Upload a JD opens once the JD is read. `edit`
 * opens it on the §7.5 review, which a JD that could not be read starts on.
 */
export function jdHref(id: string, options: { edit?: boolean } = {}): Route {
  return `/jd/${encodeURIComponent(id)}${options.edit ? '?edit=1' : ''}` as Route;
}

/** The tailor flow for a job description (734:2, toreview §110). */
export function jdTailorHref(id: string, options: { mode?: 'build' } = {}): Route {
  return `/jd/${encodeURIComponent(id)}/tailor${options.mode ? `?mode=${options.mode}` : ''}` as Route;
}
