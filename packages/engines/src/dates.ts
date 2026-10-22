/**
 * Dates as the engines read them: a year, and a month when the source states one. A resume often
 * says only "2019 – 2021", and that precision is kept rather than invented (G3). There is no clock
 * here: an open-ended role ends at `asOf`, which the caller passes in and the result records (G12).
 */

export interface PartialDate {
  year: number;
  /** 1–12, absent when only the year is known. */
  month?: number;
}

/** A role or course: `end` null means "present", read as `asOf`. */
export interface DatedSpan {
  start?: PartialDate | null;
  end?: PartialDate | null;
}

const ISO = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

/**
 * Reads `YYYY`, `YYYY-MM` or `YYYY-MM-DD`. A full date keeps its month; the day is dropped, since
 * nothing the engines decide depends on it. Returns null for anything else.
 */
export function parsePartialDate(value: string | null | undefined): PartialDate | null {
  if (!value) return null;
  const match = ISO.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  if (match[2] === undefined) return { year };
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export function formatPartialDate(date: PartialDate): string {
  return date.month === undefined ? String(date.year) : `${date.year}-${String(date.month).padStart(2, '0')}`;
}

/**
 * A month number for interval arithmetic. A year-only date counts from January, the way resume
 * parsers read "2019 – 2021" as two years; it never stretches a span to flatter it.
 */
export function monthIndex(date: PartialDate): number {
  return date.year * 12 + ((date.month ?? 1) - 1);
}

/**
 * The year a span ends: "present" (`end: null`) reads as `asOf`; an end that is simply missing
 * (`undefined`) is unknown, and the caller must not guess it.
 */
export function endYear(span: DatedSpan, asOf: PartialDate): number | null {
  if (span.end === null) return asOf.year;
  return span.end === undefined ? null : span.end.year;
}

/**
 * [startMonth, endMonth) of a span, or null when it has no start. "Present" ends at `asOf`; a
 * missing end counts as no time at all rather than a guess.
 */
export function monthRange(span: DatedSpan, asOf: PartialDate): [number, number] | null {
  if (!span.start) return null;
  const start = monthIndex(span.start);
  if (span.end === undefined) return [start, start];
  const end = span.end === null ? monthIndex(asOf) : monthIndex(span.end);
  return end > start ? [start, end] : [start, start];
}

/** Total months covered by a set of ranges, overlaps counted once. */
export function unionMonths(ranges: readonly (readonly [number, number])[]): number {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let total = 0;
  let current: [number, number] | null = null;
  for (const [start, end] of sorted) {
    if (!current || start > current[1]) {
      if (current) total += current[1] - current[0];
      current = [start, end];
    } else if (end > current[1]) {
      current[1] = end;
    }
  }
  if (current) total += current[1] - current[0];
  return total;
}

/** Whether two spans overlap in time (open ends read as `asOf`). */
export function spansOverlap(a: DatedSpan, b: DatedSpan, asOf: PartialDate): boolean {
  const ra = monthRange(a, asOf);
  const rb = monthRange(b, asOf);
  if (!ra || !rb) return false;
  return ra[0] <= rb[1] && rb[0] <= ra[1];
}
