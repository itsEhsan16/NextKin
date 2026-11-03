import { analyzeDoc } from './doc';
import { analyzeDocx } from './docx';
import { pdfLayout, textFileLayout } from './layout';
import { analyzePdf } from './pdf';
import { UnreadableError, type Analysis, type FileKind, type HiddenRun } from './types';

/**
 * The upload analyzer (ImBackendImplementationPlan P7-04, Q-05): what a file IS comes from its
 * bytes, never its extension or declared type; each kind is read by a guarded reader; hidden text
 * is separated from visible text. Runs inside the isolated parser pool (pool.ts), never on the
 * request or worker event loop.
 */

/** Pages with fewer visible characters than this are treated as scans and sent to OCR (P7-06). */
export const OCR_MIN_CHARS_PER_PAGE = 80;

export function sniff(bytes: Uint8Array): FileKind {
  const b = bytes;
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return 'pdf'; // %PDF-
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) {
    // A zip; a DOCX names its main part in the first entries' file names.
    const head = new TextDecoder('latin1').decode(b.subarray(0, Math.min(b.length, 64 * 1024)));
    return head.includes('word/') ? 'docx' : 'unknown';
  }
  // An OLE compound file (Word 97–2003, but also old Excel and Outlook files): the reader tells.
  if (b.length >= 8 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0 && b[4] === 0xa1 && b[5] === 0xb1 && b[6] === 0x1a && b[7] === 0xe1) return 'doc';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length >= 12 && String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...b.subarray(8, 12)) === 'WEBP') return 'webp';
  if (looksLikeText(b)) return 'txt';
  return 'unknown';
}

function looksLikeText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  const sample = bytes.subarray(0, Math.min(bytes.length, 8192));
  if (sample.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(sample.length < bytes.length ? trimPartial(sample) : sample);
    return true;
  } catch {
    return false;
  }
}

/** Drops a UTF-8 sequence cut off at the end of a sample. */
function trimPartial(bytes: Uint8Array): Uint8Array {
  const end = bytes.length;
  for (let i = 1; i <= 3 && end - i >= 0; i++) {
    const byte = bytes[end - i]!;
    if ((byte & 0xc0) === 0xc0) return bytes.subarray(0, end - i);
    if ((byte & 0x80) === 0) break;
  }
  return bytes;
}

// Zero-width and bidi-control characters carry nothing a reader sees; text hidden in them is
// reported and removed.
const INVISIBLE_CHARS = /[​-‏‪-‮⁠-⁤﻿]/g;

function analyzeTxt(bytes: Uint8Array): { text: string; hidden: HiddenRun[] } {
  const raw = new TextDecoder('utf-8').decode(bytes).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const hidden: HiddenRun[] = [];
  const count = (raw.match(INVISIBLE_CHARS) ?? []).length;
  if (count > 0) hidden.push({ page: 1, text: `${count} invisible character${count === 1 ? '' : 's'}`, reason: 'zero_width' });
  return { text: raw.replace(INVISIBLE_CHARS, '').replace(/[ \t]+/g, ' ').trim(), hidden };
}

export const DOCUMENT_KINDS: readonly FileKind[] = ['pdf', 'docx', 'txt'];
/** A job description may also be a legacy Word file (toreview §154). */
export const JD_DOCUMENT_KINDS: readonly FileKind[] = [...DOCUMENT_KINDS, 'doc'];

export async function analyze(bytes: Uint8Array, options: { allowed?: readonly FileKind[] } = {}): Promise<Analysis> {
  const kind = sniff(bytes);
  const allowed = options.allowed ?? DOCUMENT_KINDS;
  if (!allowed.includes(kind)) {
    throw new UnreadableError(kind === 'unknown' ? 'unsupported_type' : 'type_mismatch', 'Upload a PDF, Word (DOCX) or plain-text file.');
  }

  if (kind === 'pdf') {
    let result;
    try {
      result = await analyzePdf(bytes);
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      if (name === 'PasswordException') throw new UnreadableError('encrypted', 'The PDF is password-protected. Remove the password and upload it again.');
      throw new UnreadableError('corrupt', 'The PDF could not be read.');
    }
    const lowTextPages = result.charsPerPage.flatMap((chars, i) => (chars < OCR_MIN_CHARS_PER_PAGE ? [i + 1] : []));
    const images = result.images.filter((img) => lowTextPages.includes(img.page));
    return {
      kind,
      text: result.text,
      hidden: result.hidden,
      facts: { pages: result.pages, chars: result.charsPerPage.reduce((a, b) => a + b, 0), lowTextPages, ocr: images.length > 0, layout: pdfLayout(result.geometry, result.text, images.length > 0) },
      images,
      links: result.links,
    };
  }
  if (kind === 'doc') {
    let result;
    try {
      result = await analyzeDoc(bytes);
    } catch {
      // An OLE file that is not a Word document (an old .xls), or a damaged one.
      throw new UnreadableError('corrupt', 'This Word file could not be read. Save it as DOCX or PDF and upload it again.');
    }
    return { kind, text: result.text, hidden: [], facts: { pages: 1, chars: result.chars, lowTextPages: [], ocr: false }, images: [] };
  }
  if (kind === 'docx') {
    const result = analyzeDocx(bytes);
    return { kind, text: result.text, hidden: result.hidden, facts: { pages: result.pages, chars: result.text.replace(/\s+/g, '').length, lowTextPages: [], ocr: false, layout: result.layout }, images: [] };
  }
  if (kind === 'txt') {
    const result = analyzeTxt(bytes);
    return { kind, text: result.text, hidden: result.hidden, facts: { pages: 1, chars: result.text.replace(/\s+/g, '').length, lowTextPages: [], ocr: false, layout: textFileLayout(result.text) }, images: [] };
  }
  // Images (avatars) carry no text to read; the sniffed kind is what the caller needed.
  return { kind, text: '', hidden: [], facts: { pages: 0, chars: 0, lowTextPages: [], ocr: false }, images: [] };
}
