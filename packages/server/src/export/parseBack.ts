import { analyzeDocx } from '../parsing/docx';
import { expectedLines, type RenderModel } from './model';

/**
 * Parse-back (ImBackendImplementationPlan P10-06, old Q-06). Every export is read back the way a
 * simple applicant tracking system reads it, and compared with the canonical model it came from.
 *
 * A PDF is read by position, line by line down each page, left to right along each line: what a
 * naive extractor does, and what a multi-column layout defeats (its columns interleave). DOCX and
 * TXT are read as text. Each line the model says the file holds must be found, in order. Spacing,
 * case and bullet glyphs are ignored; words, numbers and their order are not.
 */

export interface ParseBackResult {
  ok: boolean;
  /** Lines of the model not found in the file, in order. */
  missing: string[];
  /** Found, but before an earlier line: the reading order is broken. */
  outOfOrder: string[];
  /** Section headings whose section lost anything. */
  sectionsLost: string[];
  checked: number;
}

const squash = (text: string) =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[•▪◦●·‣•]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, '');

/** The page's text in reading order, by position: lines top to bottom, items left to right. */
export async function pdfReadingText(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, stopAtErrors: true } as Parameters<typeof pdfjs.getDocument>[0]);
  const doc = await task.promise;
  const out: string[] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const items = content.items
        .filter((i): i is typeof i & { str: string; transform: number[]; width: number } => 'str' in i && i.str.trim().length > 0)
        .map((i) => ({ text: i.str, x: i.transform[4]!, y: i.transform[5]!, width: i.width }));
      const lines: { y: number; items: typeof items }[] = [];
      for (const item of items) {
        const line = lines.find((l) => Math.abs(l.y - item.y) < 2.5);
        if (line) line.items.push(item);
        else lines.push({ y: item.y, items: [item] });
      }
      lines.sort((a, b) => b.y - a.y);
      for (const line of lines) out.push(line.items.sort((a, b) => a.x - b.x).map((i) => i.text).join(' '));
    }
  } finally {
    await task.destroy();
  }
  return out.join('\n');
}

export const docxReadingText = (bytes: Uint8Array): string => analyzeDocx(bytes).text;

/** Compares extracted text with the model's lines. */
export function compareWithModel(model: RenderModel, text: string): ParseBackResult {
  const stream = squash(text);
  const lines = expectedLines(model);
  const missing: string[] = [];
  const outOfOrder: string[] = [];
  let cursor = 0;
  for (const line of lines) {
    const needle = squash(line);
    if (!needle) continue;
    const at = stream.indexOf(needle, cursor);
    if (at >= 0) {
      cursor = at + needle.length;
      continue;
    }
    if (stream.includes(needle)) outOfOrder.push(line);
    else missing.push(line);
  }
  const lost = new Set([...missing, ...outOfOrder]);
  const sectionsLost = model.sections
    .filter((s) => {
      const own = expectedLines({ ...model, name: '', contact: [], sections: [s] }).filter(Boolean);
      return own.some((l) => lost.has(l));
    })
    .map((s) => s.heading || 'Letter');
  return { ok: lost.size === 0, missing, outOfOrder, sectionsLost, checked: lines.length };
}

export async function parseBack(model: RenderModel, format: 'pdf' | 'docx' | 'txt', bytes: Uint8Array): Promise<ParseBackResult> {
  const text = format === 'pdf' ? await pdfReadingText(bytes) : format === 'docx' ? docxReadingText(bytes) : new TextDecoder().decode(bytes);
  return compareWithModel(model, text);
}
