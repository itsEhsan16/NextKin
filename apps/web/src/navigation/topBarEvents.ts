/**
 * Asks the open page to act for the top bar's primary action, when that action opens something
 * of the page's own rather than a route: Resumes' "Create New Resume" opens its create dialog
 * (toreview §254: it used to sit above the preview panel; the bar is where every page's primary
 * action lives).
 */
export const CREATE_RESUME_EVENT = 'nextkin:create-resume';
