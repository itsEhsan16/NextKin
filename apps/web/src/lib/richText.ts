export type BoldRun = { text: string; bold: boolean };

/**
 * Splits a `**bold**` string into runs. Activity and notification bodies carry emphasis in the
 * data (V2 models note this), so the copy stays one string and the renderer decides the weight.
 * Mirrors `apps/mobile/src/lib/richText.ts`.
 */
export function parseBold(value: string): BoldRun[] {
  const runs: BoldRun[] = [];
  const pattern = /\*\*([^*]+)\*\*/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > cursor) runs.push({ text: value.slice(cursor, match.index), bold: false });
    runs.push({ text: match[1] ?? '', bold: true });
    cursor = match.index + match[0].length;
  }
  if (cursor < value.length) runs.push({ text: value.slice(cursor), bold: false });
  return runs;
}
