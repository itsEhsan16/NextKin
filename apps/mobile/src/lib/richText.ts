/** One run of a rich notification line (Figma 1:2425 mixes regular and semibold spans). */
export type BoldRun = { text: string; bold: boolean };

/**
 * Splits a `**bold**`-marked string into runs. Unterminated markers render literally rather
 * than silently swallowing text — fixture typos should be visible, not destructive.
 */
export function parseBold(value: string): BoldRun[] {
  const runs: BoldRun[] = [];
  let rest = value;
  while (rest.length > 0) {
    const open = rest.indexOf('**');
    if (open === -1) {
      runs.push({ text: rest, bold: false });
      break;
    }
    const close = rest.indexOf('**', open + 2);
    if (close === -1) {
      runs.push({ text: rest, bold: false });
      break;
    }
    if (open > 0) runs.push({ text: rest.slice(0, open), bold: false });
    runs.push({ text: rest.slice(open + 2, close), bold: true });
    rest = rest.slice(close + 2);
  }
  return runs.filter((run) => run.text.length > 0);
}

/** The plain reading of a rich line — accessibility labels and tests use this. */
export function stripBold(value: string): string {
  return parseBold(value)
    .map((run) => run.text)
    .join('');
}
