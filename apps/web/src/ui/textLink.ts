/**
 * A link-styled action in running text: "Edit details", "Say where", "Try again" (toreview §131).
 * Brand ink, underline on hover, the app's focus ring. One whole string so Tailwind reads it;
 * callers add layout (`flex gap-1.5`, a type size) beside it.
 */
export const textLink =
  'rounded-sm font-semibold text-text-brand underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60 disabled:hover:no-underline';
