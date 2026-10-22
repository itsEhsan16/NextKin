import { phraseKey } from '@nextkin/engines/text';

/** Whether `text` contains `phrase` as whole words. */
export const says = (text: string, phrase: string): boolean => ` ${phraseKey(text)} `.includes(` ${phraseKey(phrase)} `);

/** The JD's own line or sentence naming a keyword, as whole words, at most 160 characters. */
export function quoteOf(rawText: string | undefined, label: string): string | undefined {
  if (!rawText) return undefined;
  const lines = rawText.split(/\r?\n|(?<=[.;!?])\s+/).map((l) => l.trim()).filter((l) => l.length > 2);
  const line = lines.find((l) => says(l, label));
  if (!line) return undefined;
  return line.length > 160 ? `${line.slice(0, 157).trimEnd()}…` : line;
}
