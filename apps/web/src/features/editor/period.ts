import { printPeriod } from '@nextkin/shared/scoring/canonical';

/** An entry's dates as the page prints them; nothing at all when it has no start. */
export const periodText = (start: string | null, end: string | null): string =>
  start ? printPeriod(start, end) : '';
