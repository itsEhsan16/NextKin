/** Adds `value` if it is missing and removes it if present: a multi-select filter's checkbox. */
export const toggleItem = <T>(list: readonly T[], value: T): T[] =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

/** The first of each value, in order. */
export const distinct = <T>(values: readonly T[]): T[] => Array.from(new Set(values));
