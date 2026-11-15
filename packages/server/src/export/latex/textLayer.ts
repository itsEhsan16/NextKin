import { decodePDFRawStream, PDFDocument, PDFRawStream } from 'pdf-lib';

/**
 * The typeset PDF's text layer, with a hyphen that reads as a hyphen (owner, 2026-11-15;
 * toreview §211.1). A page looks the same either way: this changes only what copy, search and a
 * resume checker read out of it.
 *
 * What was wrong. Lato, Roboto and the other faces draw one glyph for U+002D (the keyboard
 * hyphen), U+2010 (HYPHEN), U+2011 and U+00AD. XeTeX's PDF writer names each glyph's character in
 * a ToUnicode table built from the font, and where a glyph has several it keeps the highest, so
 * every "-" a resume typed came out of the file as U+2010. "AI‐Native Product Manager" is then a
 * different string from the job's "AI-Native Product Manager", and an outside checker reported
 * the job title, and every hyphenated keyword, as missing. No TeX setting changes that choice
 * (`\XeTeXgenerateactualtext` is ignored by most readers), so the table itself is corrected.
 *
 * What this does. Each ToUnicode table in the file has its HYPHEN, NON-BREAKING HYPHEN and SOFT
 * HYPHEN entries pointed at U+002D instead. Nothing else in the file is touched. If the file
 * cannot be read or rewritten, it is returned as it came: a readable resume beats none.
 */

/** A whole table line: `<glyph> <2010>` (bfchar), or `<glyph> <glyph> <2010>` (a one-glyph bfrange). */
const HYPHEN_ENTRY = /^([ \t]*<([0-9A-Fa-f]{4})>[ \t]+(?:<\2>[ \t]+)?)<(?:2010|2011|00[Aa][Dd])>[ \t]*$/gm;

export async function plainHyphens(pdf: Uint8Array): Promise<Uint8Array> {
  try {
    const doc = await PDFDocument.load(pdf, { updateMetadata: false });
    let changed = false;
    for (const [ref, object] of doc.context.enumerateIndirectObjects()) {
      if (!(object instanceof PDFRawStream)) continue;
      let table: string;
      try {
        table = Buffer.from(decodePDFRawStream(object).decode()).toString('latin1');
      } catch {
        continue; // An image or a stream in a filter we do not read: not a character table.
      }
      if (!table.includes('begincmap')) continue;
      const fixed = table.replace(HYPHEN_ENTRY, '$1<002D>');
      if (fixed === table) continue;
      doc.context.assign(ref, doc.context.flateStream(Buffer.from(fixed, 'latin1')));
      changed = true;
    }
    return changed ? await doc.save() : pdf;
  } catch {
    return pdf;
  }
}
