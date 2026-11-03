import WordExtractor from 'word-extractor';

/**
 * Legacy Word documents (.doc, Word 97–2003; owner, 2026-11-03, toreview §154): the body, then any
 * text boxes, read from the OLE file by `word-extractor`, a small pure-JavaScript reader, inside the
 * isolated parser like every other kind. The binary format keeps hidden text as run properties the
 * reader does not expose, so hidden text is not separated for a .doc (a DOCX's is); the extraction
 * still keeps only what it can quote, so nothing hidden can add a claim the visible text lacks.
 */
export async function analyzeDoc(bytes: Uint8Array): Promise<{ text: string; chars: number }> {
  const document = await new WordExtractor().extract(Buffer.from(bytes));
  const body = document.getBody();
  const boxes = document.getTextboxes({ includeHeadersAndFooters: false, includeBody: true });
  const text = [body, boxes]
    .map((part) => part.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim())
    .filter(Boolean)
    .join('\n\n');
  return { text, chars: text.replace(/\s+/g, '').length };
}
