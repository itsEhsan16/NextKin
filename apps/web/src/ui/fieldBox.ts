/**
 * A form field's box: the Preferences board's selects and salary amount (356:42-80). It has the
 * header search's border, radius and `control-md` height, so every field in the app reads as one
 * kind of thing. The board's faint drop shadow is left off, as the search has none. A constant,
 * like `outlineButton`, so each caller keeps its own padding and width.
 */
export const fieldBox =
  'flex h-control-md w-full min-w-0 items-center rounded-md border border-border-default ' +
  'bg-surface-card text-body-m text-text-primary transition-colors duration-press ease-standard ' +
  'enabled:hover:border-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-brand-600 disabled:cursor-default';
