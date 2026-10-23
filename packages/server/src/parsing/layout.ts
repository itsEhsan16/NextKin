import type { FormatFacts } from '@nextkin/engines/document';
import { EMAIL, PHONE, isPhone } from '@nextkin/shared/privacy/contact';

/**
 * How an uploaded file is laid out, as an applicant tracking system reads it (toreview §110.6).
 * Measured from the file, never assumed: the score's layout part and W-TAILOR 01's Layout row read
 * this, and say what it rests on (`found`). What a format cannot show is said too: a PDF has no
 * tables to see, only text placed on a page, so for a PDF "no tables" is the images it painted.
 */
export type FileLayout = Omit<FormatFacts, 'consistentDates'> & {
  /** One line per finding, plain words, for the row ("two columns of text", "a photo or logo"). */
  found: string[];
};

/** Headings an ATS files sections under (English and German), as a whole line. */
export const HEADING =
  /^(?:professional |work |career |technical |core |key |personal |academic |relevant )?(?:summary|profile|objective|about me|experience|employment(?: history)?|work history|education|skills|projects|certifications?|certificates|licen[cs]es|awards|achievements|publications|languages|interests|volunteer(?:ing| experience)?|extracurricular(?: activities)?|activities|leadership|courses|training|references|berufserfahrung|ausbildung|kenntnisse|projekte|sprachen|zusammenfassung)\s*:?$/i;

/** The text's own section headings: two or more an ATS knows. */
export function standardHeadingsIn(text: string): { ok: boolean; count: number } {
  const count = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length <= 40 && HEADING.test(line)).length;
  return { ok: count >= 2, count };
}

/** An email or a phone number the body text states (not only a header, a footer or a picture). */
export const contactIn = (text: string): boolean => new RegExp(EMAIL.source, 'i').test(text) || [...text.matchAll(new RegExp(PHONE.source, 'g'))].some((m) => isPhone(m[0]));

/** One page's text lines, each as its segments, and its painted images, in page units. */
export interface PageGeometry {
  width: number;
  height: number;
  lines: { segments: { start: number; end: number }[] }[];
  images: { width: number; height: number }[];
}

const COLUMN_OFFSET = 0.2; // of the page width, beyond the left margin
const COLUMN_ALIGN = 0.02; // of the page width: a column's lines start together
const COLUMN_LINES = 5;
const COLUMN_SHARE = 0.15; // of a page's lines
const FLUSH_RIGHT = 0.03; // of the page width, from the text's right edge
const SHORT = 0.3; // of the page width
const IMAGE_SHARE = 0.01; // of the page area: a photo or a logo, not an icon

/**
 * A second column is many segments starting together well right of the left margin. What looks
 * like one and is not: dates and places set flush right (short, ending at the text's right edge,
 * and starting wherever their width puts them), and a centred name and contact line (two lines).
 */
export function hasSecondColumn(page: PageGeometry): boolean {
  const segments = page.lines.flatMap((line) => line.segments).filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end));
  if (page.lines.length < 10 || segments.length === 0) return false;
  const margin = Math.min(...segments.map((s) => s.start));
  const rightEdge = Math.max(...segments.map((s) => s.end));
  const far = segments
    .filter((s) => s.start - margin > page.width * COLUMN_OFFSET)
    .filter((s) => !(s.end >= rightEdge - page.width * FLUSH_RIGHT && s.end - s.start < page.width * SHORT))
    .map((s) => s.start)
    .sort((a, b) => a - b);
  // The largest group of starts within COLUMN_ALIGN of each other.
  let best = 0;
  for (let i = 0, j = 0; j < far.length; j++) {
    while (far[j]! - far[i]! > page.width * COLUMN_ALIGN) i++;
    best = Math.max(best, j - i + 1);
  }
  return best >= COLUMN_LINES && best / page.lines.length >= COLUMN_SHARE;
}

export function pdfLayout(pages: readonly PageGeometry[], text: string, ocr: boolean): FileLayout {
  const found: string[] = [];
  let columns = false;
  let images = 0;
  for (const page of pages) {
    if (hasSecondColumn(page)) columns = true;
    images += page.images.filter((image) => image.width * image.height >= page.width * page.height * IMAGE_SHARE).length;
  }
  const headings = standardHeadingsIn(text);
  const contact = contactIn(text);
  if (columns) found.push('text in two or more columns, which an ATS may read out of order');
  if (images) found.push(images === 1 ? 'a picture (a photo or a logo)' : `${images} pictures`);
  if (!headings.ok) found.push('few of the section headings an ATS looks for');
  if (!contact) found.push('no email or phone number in the text');
  if (ocr) found.push('text that is only an image, read by OCR');
  return { singleColumn: !columns, noTablesOrImages: images === 0, standardHeadings: headings.ok, standardFonts: !ocr, contactInBody: contact, found };
}

/** Fonts an ATS and every reader's computer have, or ship metric twins of. */
const STANDARD_FONT =
  /^(?:arial|calibri|cambria|candara|aptos|times new roman|times|georgia|garamond|helvetica|verdana|tahoma|trebuchet ms|book antiqua|palatino(?: linotype)?|century gothic|segoe ui|lato|roboto|open sans|source sans pro|liberation (?:sans|serif)|carlito|caladea|noto sans|noto serif)$/i;

/** Whether a font name is one an ATS and every reader's computer have (or a metric twin of one). */
export const isStandardFont = (name: string): boolean => STANDARD_FONT.test(name.trim());

/**
 * A Word document says what it holds: tables (`w:tbl`), text boxes (`w:txbxContent`), pictures
 * (`w:drawing`, `w:pict`), newspaper columns (`w:cols w:num`), and its fonts (`w:rFonts`). Contact
 * details only in a page header or footer are skipped by many ATS, so the body is checked alone.
 */
export function docxLayout(bodyXml: string, bodyText: string): FileLayout {
  const found: string[] = [];
  const tables = (bodyXml.match(/<w:tbl\b/g) ?? []).length;
  const boxes = (bodyXml.match(/<w:txbxContent\b/g) ?? []).length;
  const pictures = (bodyXml.match(/<w:(?:drawing|pict)\b/g) ?? []).length;
  const columns = [...bodyXml.matchAll(/<w:cols\b[^>]*\bw:num="(\d+)"/g)].some((m) => Number(m[1]) > 1);
  const fonts = [...new Set([...bodyXml.matchAll(/<w:rFonts\b[^>]*\bw:ascii="([^"]+)"/g)].map((m) => m[1]!.trim()))];
  const odd = fonts.filter((font) => !STANDARD_FONT.test(font));
  const headings = standardHeadingsIn(bodyText);
  const contact = contactIn(bodyText);
  if (columns) found.push('page columns, which an ATS may read out of order');
  if (tables) found.push(tables === 1 ? 'a table' : `${tables} tables`);
  if (boxes) found.push(boxes === 1 ? 'a text box' : `${boxes} text boxes`);
  if (pictures) found.push(pictures === 1 ? 'a picture' : `${pictures} pictures`);
  if (odd.length) found.push(`the font${odd.length > 1 ? 's' : ''} ${odd.slice(0, 3).join(', ')}`);
  if (!headings.ok) found.push('few of the section headings an ATS looks for');
  if (!contact) found.push('no email or phone number in the body (a header or footer is often skipped)');
  return { singleColumn: !columns && tables === 0, noTablesOrImages: tables + boxes + pictures === 0, standardHeadings: headings.ok, standardFonts: odd.length === 0, contactInBody: contact, found };
}

/** Plain text has no layout to get wrong: one column, no pictures, its own headings and contact. */
export function textFileLayout(text: string): FileLayout {
  const headings = standardHeadingsIn(text);
  const contact = contactIn(text);
  const found = [...(!headings.ok ? ['few of the section headings an ATS looks for'] : []), ...(!contact ? ['no email or phone number in the text'] : [])];
  return { singleColumn: true, noTablesOrImages: true, standardHeadings: headings.ok, standardFonts: true, contactInBody: contact, found };
}
