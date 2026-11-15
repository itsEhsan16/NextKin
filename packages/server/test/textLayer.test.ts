import { decodePDFRawStream, PDFDocument, PDFRawStream } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { plainHyphens } from '../src/export/latex/textLayer';

/**
 * The typeset PDF's text layer (toreview §211.1): a hyphen must read as U+002D, or "AI-Native"
 * on the page is not "AI-Native" to a resume checker. A real compile is covered in
 * `integration/latexCompile.int.test.ts`; this holds the table rewrite itself.
 */

const CMAP = (rows: string) =>
  ['/CIDInit /ProcSet findresource begin', '12 dict begin', 'begincmap', '1 begincodespacerange', '<0000> <FFFF>', 'endcodespacerange', rows, 'endcmap', 'end end'].join('\n');

async function withTable(rows: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage();
  doc.context.register(doc.context.flateStream(CMAP(rows)));
  return doc.save();
}

async function tablesOf(pdf: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(pdf);
  const out: string[] = [];
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream)) continue;
    try {
      const text = Buffer.from(decodePDFRawStream(object).decode()).toString('latin1');
      if (text.includes('begincmap')) out.push(text);
    } catch {
      // not a table
    }
  }
  return out;
}

describe('the hyphen in a typeset PDF', () => {
  it('reads as the keyboard hyphen, whichever hyphen the font named it', async () => {
    const pdf = await withTable(['4 beginbfchar', '<0010> <2010>', '<0011> <2011>', '<0012> <00AD>', '<0013> <0041>', 'endbfchar'].join('\n'));
    const [table] = await tablesOf(await plainHyphens(pdf));
    expect(table).toContain('<0010> <002D>');
    expect(table).toContain('<0011> <002D>');
    expect(table).toContain('<0012> <002D>');
    expect(table).toContain('<0013> <0041>');
    expect(table).not.toMatch(/<2010>|<2011>|<00AD>/);
  });

  it('fixes a one-glyph range, and leaves a real range and every other character alone', async () => {
    const rows = ['3 beginbfrange', '<0010> <0010> <2010>', '<0020> <0025> <2010>', '<0030> <0030> <2013>', 'endbfrange'].join('\n');
    const [table] = await tablesOf(await plainHyphens(await withTable(rows)));
    expect(table).toContain('<0010> <0010> <002D>');
    // A range that starts at HYPHEN names six different characters: not ours to rewrite.
    expect(table).toContain('<0020> <0025> <2010>');
    expect(table).toContain('<0030> <0030> <2013>');
  });

  it('hands back the same bytes when there is nothing to fix, or the file cannot be read', async () => {
    const clean = await withTable(['1 beginbfchar', '<0013> <0041>', 'endbfchar'].join('\n'));
    expect(await plainHyphens(clean)).toBe(clean);
    const junk = new Uint8Array([1, 2, 3, 4]);
    expect(await plainHyphens(junk)).toBe(junk);
  });
});
