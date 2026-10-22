import { XMLParser } from 'fast-xml-parser';
import { unzipSync, type UnzipFileInfo } from 'fflate';
import { docxLayout, type FileLayout } from './layout';
import { UnreadableError, type HiddenRun } from './types';

/**
 * DOCX analysis (ImBackendImplementationPlan P7-04). A DOCX is a zip of XML, so both of its classic
 * attacks are closed before anything is parsed:
 * - **zip bombs**: the central directory's sizes are checked before a byte is inflated — entry
 *   count, total uncompressed size and per-entry compression ratio — and only the parts we read are
 *   inflated at all;
 * - **XXE**: any document with a DOCTYPE is refused outright, and the parser never expands entities.
 *
 * Hidden runs are reported and dropped from the text: `w:vanish` and `w:webHidden`, white text
 * (`w:color` FFFFFF, with no shading behind it), and text under 2 points (`w:sz` under 4 half-points).
 */

const MAX_ENTRIES = 1000;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const MAX_RATIO = 100;
const PARTS = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/;
/** Word's own page count, saved with the file (`<Pages>`): read as a number, never walked as text. */
const APP_PROPS = 'docProps/app.xml';

export interface DocxAnalysis {
  text: string;
  hidden: HiddenRun[];
  pages: number;
  /** How the body is laid out (`layout.ts`). */
  layout: FileLayout;
}

type Node = Record<string, unknown>;

export function analyzeDocx(bytes: Uint8Array): DocxAnalysis {
  let entries = 0;
  let total = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter(file: UnzipFileInfo) {
        entries++;
        total += file.originalSize;
        if (entries > MAX_ENTRIES || total > MAX_TOTAL_BYTES) throw new UnreadableError('zip_bomb', 'The file expands to far more than a document should.');
        if (file.size > 0 && file.originalSize / file.size > MAX_RATIO) throw new UnreadableError('zip_bomb', 'The file expands to far more than a document should.');
        return PARTS.test(file.name) || file.name === APP_PROPS;
      },
    });
  } catch (error) {
    if (error instanceof UnreadableError) throw error;
    throw new UnreadableError('corrupt', 'The file is not a readable Word document.');
  }
  if (!files['word/document.xml']) throw new UnreadableError('corrupt', 'The file is not a readable Word document.');

  const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: '@', processEntities: false, htmlEntities: false, trimValues: false });
  const hidden: HiddenRun[] = [];
  const paragraphs: string[] = [];

  // The body first, then headers, footers and notes, in a stable order.
  const order = Object.keys(files)
    .filter((name) => name !== APP_PROPS)
    .sort((a, b) => (a === 'word/document.xml' ? -1 : b === 'word/document.xml' ? 1 : a.localeCompare(b)));
  let bodyXml = '';
  let bodyParagraphs = 0;
  for (const name of order) {
    const xml = new TextDecoder().decode(files[name]);
    if (/<!DOCTYPE/i.test(xml)) throw new UnreadableError('dtd_refused', 'The file declares a DOCTYPE, which Word documents never need.');
    walk(parser.parse(xml) as Node[], paragraphs, hidden);
    if (name === 'word/document.xml') {
      bodyXml = xml;
      bodyParagraphs = paragraphs.length;
    }
  }
  const clean = (list: string[]) => list.map((p) => p.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');
  const text = clean(paragraphs);
  const saved = files[APP_PROPS] ? Number(/<Pages>(\d{1,3})<\/Pages>/.exec(new TextDecoder().decode(files[APP_PROPS]))?.[1] ?? 0) : 0;
  const pages = saved > 0 ? saved : 1 + paragraphs.filter((p) => p === '\f').length;
  return { text, hidden, pages, layout: docxLayout(bodyXml, clean(paragraphs.slice(0, bodyParagraphs))) };
}

const childrenOf = (node: Node): Node[] => {
  const key = Object.keys(node).find((k) => k !== ':@');
  return key && Array.isArray(node[key]) ? (node[key] as Node[]) : [];
};
const tagOf = (node: Node) => Object.keys(node).find((k) => k !== ':@') ?? '';
const attrs = (node: Node) => (node[':@'] ?? {}) as Record<string, string>;
const find = (nodes: Node[], tag: string) => nodes.find((n) => tagOf(n) === tag);

function runHidden(props: Node[] | undefined): HiddenRun['reason'] | null {
  if (!props) return null;
  if (find(props, 'w:vanish') || find(props, 'w:webHidden')) return 'hidden_run';
  const size = find(props, 'w:sz');
  if (size && Number(attrs(size)['@w:val']) < 4) return 'tiny';
  const color = find(props, 'w:color');
  const shading = find(props, 'w:shd');
  const fillBehind = shading ? (attrs(shading)['@w:fill'] ?? 'auto').toUpperCase() : 'AUTO';
  if (color && /^(FFFFFF|FEFEFE|FDFDFD)$/i.test(attrs(color)['@w:val'] ?? '') && (fillBehind === 'AUTO' || fillBehind === 'FFFFFF')) return 'background';
  return null;
}

function walk(nodes: Node[], paragraphs: string[], hidden: HiddenRun[]): void {
  for (const node of nodes) {
    const tag = tagOf(node);
    if (tag === 'w:p') {
      let text = '';
      collectRuns(childrenOf(node), (run, reason) => {
        if (reason) hidden.push({ page: 1, text: run.trim().slice(0, 300), reason });
        else text += run;
      });
      paragraphs.push(text);
      // A page break inside the paragraph counts toward the page tally.
      if (JSON.stringify(node).includes('"@w:type":"page"')) paragraphs.push('\f');
    } else {
      walk(childrenOf(node), paragraphs, hidden);
    }
  }
}

function collectRuns(nodes: Node[], emit: (text: string, reason: HiddenRun['reason'] | null) => void): void {
  for (const node of nodes) {
    const tag = tagOf(node);
    if (tag === 'w:r') {
      const children = childrenOf(node);
      const props = find(children, 'w:rPr');
      const reason = runHidden(props ? childrenOf(props) : undefined);
      let text = '';
      for (const child of children) {
        const t = tagOf(child);
        if (t === 'w:t') text += childrenOf(child).map((c) => String((c as { '#text'?: unknown })['#text'] ?? '')).join('');
        else if (t === 'w:tab') text += '\t';
        else if (t === 'w:br' || t === 'w:cr') text += '\n';
      }
      if (text) emit(text, reason);
    } else if (tag === 'w:hyperlink' || tag === 'w:ins' || tag === 'w:smartTag' || tag === 'w:sdt' || tag === 'w:sdtContent' || tag === 'w:fldSimple') {
      collectRuns(childrenOf(node), emit);
    }
    // w:del (deleted text) is never part of the document's text.
  }
}
