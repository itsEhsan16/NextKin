import type { FileLink } from './header';
import type { PageGeometry } from './layout';
import type { HiddenRun, PageImage } from './types';

/**
 * PDF analysis (ImBackendImplementationPlan P7-04, Q-05). `pdfjs-dist` 6.4, which contains no
 * `eval` or `Function` constructor at all (the CVE-2024-4367 path was removed; a test re-checks the
 * bundled worker on every upgrade), fonts never loaded into the process, and the operator list interpreted
 * here rather than trusting `getTextContent`: that one keeps invisible and white text and silently
 * drops text placed off the page, so it can neither hide nor report what a reader cannot see.
 *
 * Every text run is placed (text matrix × CTM) and classified:
 * - `invisible`: render mode 3 or 7 (no fill, no stroke);
 * - `background`: a fill colour within a few levels of whatever was painted behind it (white text on
 *   a white page; white text on a dark band is visible and kept);
 * - `tiny`: an effective size under 2 points;
 * - `off_page`: placed outside the page box.
 * Hidden runs are reported to the user and are absent from `text`, the only thing downstream reads (G9).
 */

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[1] * n[2],
  m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2],
  m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4],
  m[4] * n[1] + m[5] * n[3] + n[5],
];
/**
 * An operator's matrix: six numbers, or (pdfjs 6, for `Tm`) one typed array holding them. Read as
 * six numbers, the typed array made every text position NaN, so a page read as one long line and
 * its hidden-text checks never fired (toreview §110.6).
 */
const matrixOf = (args: unknown[]): Matrix => {
  const first = args[0];
  const values = ArrayBuffer.isView(first) || Array.isArray(first) ? Array.from(first as ArrayLike<number>) : (args as number[]);
  return values.length >= 6 ? (values.slice(0, 6).map(Number) as Matrix) : IDENTITY;
};
const apply = (m: Matrix, x: number, y: number): [number, number] => [x * m[0] + y * m[2] + m[4], x * m[1] + y * m[3] + m[5]];

const rgb = (hex: string): [number, number, number] => {
  const n = /^#([0-9a-f]{6})$/i.exec(hex)?.[1];
  if (!n) return [0, 0, 0];
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
};
const distance = (a: [number, number, number], b: [number, number, number]) => Math.max(...a.map((v, i) => Math.abs(v - b[i]!)));

const MIN_SIZE_PT = 2;
/** In thousandths of an em: wider than any word space a justified line stretches to. */
const WIDE_GAP = 2000;
/** Of an em: a gap between two runs on a line this wide is a word space (a space is ~0.25em; kerning and tracking stay well under). */
const WORD_GAP_EM = 0.15;
const BACKGROUND_TOLERANCE = 24; // of 255, per channel
const WHITE: [number, number, number] = [255, 255, 255];

interface Run {
  text: string;
  x: number;
  /** Where the run's advance ends, in page units. */
  end: number;
  y: number;
  size: number;
  hidden: HiddenRun['reason'] | null;
}

interface Painted {
  box: [number, number, number, number];
  color: [number, number, number] | 'image';
}

export interface PdfAnalysis {
  pages: number;
  text: string;
  hidden: HiddenRun[];
  /** Images painted on pages with too little text (scans), for OCR. */
  images: PageImage[];
  /** Visible characters per page, for the OCR threshold. */
  charsPerPage: number[];
  /** Where each page's visible lines start and what pictures it paints, for `layout.ts`. */
  geometry: PageGeometry[];
  /** Link annotations with the visible text under them (https, mailto, tel only), for the header. */
  links: FileLink[];
}

/**
 * Each visible line (runs on one baseline) as its segments, split where a gap wider than
 * `SEGMENT_GAP` of the page separates two runs: side-by-side columns share baselines, so a line
 * that only knew its leftmost run would hide a sidebar. Page units from the left edge.
 */
const SEGMENT_GAP = 0.06;

function lineSegments(runs: readonly Run[], left: number, width: number): PageGeometry['lines'] {
  const visible = runs.filter((r) => !r.hidden).sort((a, b) => b.y - a.y);
  const lines: Run[][] = [];
  let y = Number.NaN;
  let tolerance = 0;
  for (const run of visible) {
    if (lines.length && Math.abs(run.y - y) <= tolerance) lines[lines.length - 1]!.push(run);
    else {
      lines.push([run]);
      y = run.y;
      tolerance = Math.max(1, run.size * 0.5);
    }
  }
  return lines.map((line) => {
    const sorted = [...line].sort((a, b) => a.x - b.x);
    const segments: { start: number; end: number }[] = [];
    for (const run of sorted) {
      const last = segments[segments.length - 1];
      if (last && run.x - left - last.end <= width * SEGMENT_GAP) last.end = Math.max(last.end, run.end - left);
      else segments.push({ start: run.x - left, end: run.end - left });
    }
    return { segments };
  });
}

export async function analyzePdf(bytes: Uint8Array, options: { maxPages?: number } = {}): Promise<PdfAnalysis> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const OPS = pdfjs.OPS;
  const task = pdfjs.getDocument({
    data: bytes,
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: false,
    verbosity: 0,
  });
  const doc = await task.promise;
  const maxPages = Math.min(doc.numPages, options.maxPages ?? 30);
  const hidden: HiddenRun[] = [];
  const images: PageImage[] = [];
  const lines: string[] = [];
  const charsPerPage: number[] = [];
  const geometry: PageGeometry[] = [];
  const links: FileLink[] = [];
  const FILLS = new Set([OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke]);
  const SHOW = new Set([OPS.showText, OPS.showSpacedText, OPS.nextLineShowText, OPS.nextLineSetSpacingShowText]);
  const IMAGE = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageXObjectRepeat]);

  try {
    for (let p = 1; p <= maxPages; p++) {
      const page = await doc.getPage(p);
      const [vx0, vy0, vx1, vy1] = page.view as [number, number, number, number];
      const { fnArray, argsArray } = await page.getOperatorList();
      const runs: Run[] = [];
      const painted: Painted[] = [{ box: [vx0, vy0, vx1, vy1], color: WHITE }]; // the page itself
      const pageImageIds: { id: string; box: Painted['box'] }[] = [];
      const imageBoxes: Painted['box'][] = [];

      let ctm: Matrix = IDENTITY;
      let fill: [number, number, number] = [0, 0, 0];
      let renderMode = 0;
      let fontSize = 0;
      let leading = 0;
      let tm: Matrix = IDENTITY;
      let tlm: Matrix = IDENTITY;
      const stack: { ctm: Matrix; fill: typeof fill; renderMode: number }[] = [];

      const backgroundAt = (x: number, y: number) => {
        for (let i = painted.length - 1; i >= 0; i--) {
          const { box, color } = painted[i]!;
          if (x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3]) return color;
        }
        return WHITE;
      };
      const transformedBox = (m: Matrix, box: number[]): Painted['box'] => {
        const corners = [apply(m, box[0]!, box[1]!), apply(m, box[2]!, box[1]!), apply(m, box[0]!, box[3]!), apply(m, box[2]!, box[3]!)];
        return [Math.min(...corners.map((c) => c[0])), Math.min(...corners.map((c) => c[1])), Math.max(...corners.map((c) => c[0])), Math.max(...corners.map((c) => c[1]))];
      };

      for (let i = 0; i < fnArray.length; i++) {
        const fn = fnArray[i]!;
        const args = argsArray[i] as unknown[];
        switch (fn) {
          case OPS.save:
            stack.push({ ctm, fill, renderMode });
            break;
          case OPS.restore: {
            const s = stack.pop();
            if (s) ({ ctm, fill, renderMode } = s);
            break;
          }
          case OPS.transform:
            ctm = multiply(matrixOf(args), ctm);
            break;
          case OPS.setFillRGBColor:
            fill = rgb(String(args[0]));
            break;
          case OPS.setTextRenderingMode:
            renderMode = Number(args[0]);
            break;
          case OPS.beginText:
            tm = IDENTITY;
            tlm = IDENTITY;
            break;
          case OPS.setFont:
            fontSize = Number(args[1]);
            break;
          case OPS.setLeading:
            leading = Number(args[0]);
            break;
          case OPS.setTextMatrix:
            tm = tlm = matrixOf(args);
            break;
          case OPS.moveText:
          case OPS.setLeadingMoveText: {
            const [tx, ty] = args as [number, number];
            if (fn === OPS.setLeadingMoveText) leading = -ty;
            tm = tlm = multiply([1, 0, 0, 1, tx, ty], tlm);
            break;
          }
          case OPS.nextLine:
            tm = tlm = multiply([1, 0, 0, 1, 0, -leading], tlm);
            break;
          case OPS.constructPath: {
            // [paint op, path data, [minX, minY, maxX, maxY]] — only filled shapes hide what is behind them.
            const paint = Number(args[0]);
            const minMax = args[2] as number[] | undefined;
            if (FILLS.has(paint) && minMax && minMax.length === 4) painted.push({ box: transformedBox(ctm, minMax), color: fill });
            break;
          }
          default:
            if (IMAGE.has(fn)) {
              const box = transformedBox(ctm, [0, 0, 1, 1]);
              painted.push({ box, color: 'image' });
              imageBoxes.push(box);
              if (typeof args[0] === 'string') pageImageIds.push({ id: args[0], box });
            } else if (SHOW.has(fn)) {
              if (fn === OPS.nextLineShowText || fn === OPS.nextLineSetSpacingShowText) tm = tlm = multiply([1, 0, 0, 1, 0, -leading], tlm);
              const glyphs = (fn === OPS.nextLineSetSpacingShowText ? args[2] : args[0]) as unknown[];
              const page_ = multiply(tm, ctm);
              const [, y] = apply(page_, 0, 0);
              const size = Math.abs(fontSize) * Math.hypot(page_[2], page_[3]);
              // A run is cut into pieces at a gap wider than WIDE_GAP: LaTeX sets "Webcros … Nov
              // 2025 – Present" as one run with a fill between, and the layout check needs the two
              // apart. The text reads the same either way: pieces on a line join with a space.
              const pieces: { text: string; from: number; to: number }[] = [];
              let text = '';
              let from = 0;
              let advance = 0;
              for (const g of glyphs ?? []) {
                if (typeof g === 'number') {
                  if (g < -WIDE_GAP && text) {
                    pieces.push({ text, from, to: advance });
                    text = '';
                    from = advance - (g / 1000) * fontSize;
                  } else if (g < -200) text += ' '; // a TJ gap wide enough to be a space
                  advance -= (g / 1000) * fontSize;
                  if (!text) from = advance;
                } else if (g && typeof g === 'object') {
                  const glyph = g as { unicode?: string; width?: number };
                  if (!text) from = advance;
                  text += glyph.unicode ?? '';
                  advance += ((glyph.width ?? 500) / 1000) * fontSize;
                }
              }
              if (text) pieces.push({ text, from, to: advance });
              tm = multiply([1, 0, 0, 1, advance, 0], tm);
              for (const piece of pieces) {
                if (!piece.text.trim()) continue;
                const [px] = apply(page_, piece.from, 0);
                const [pend] = apply(page_, piece.to, 0);
                let reason: HiddenRun['reason'] | null = null;
                if (renderMode === 3 || renderMode === 7) reason = 'invisible';
                else if (px < vx0 - 1 || px > vx1 + 1 || y < vy0 - 1 || y > vy1 + 1) reason = 'off_page';
                else if (size < MIN_SIZE_PT) reason = 'tiny';
                else {
                  const behind = backgroundAt(px + 1, y + size * 0.3);
                  if (behind !== 'image' && distance(fill, behind) <= BACKGROUND_TOLERANCE) reason = 'background';
                }
                runs.push({ text: piece.text, x: px, end: pend, y, size, hidden: reason });
              }
            }
        }
      }

      // Visible text in content order: a new line when the baseline moves, a space across a gap.
      let pageText = '';
      let prev: Run | null = null;
      for (const run of runs) {
        if (run.hidden) {
          hidden.push({ page: p, text: run.text.trim().slice(0, 300), reason: run.hidden });
          continue;
        }
        if (prev) {
          const em = Math.max(prev.size, run.size);
          if (Math.abs(run.y - prev.y) > em * 0.5) pageText += '\n';
          // On one line, a space only where the gap is a word's: some writers (Canva, letter-spaced
          // exports) place every glyph as its own run and draw the spaces as blank runs, so joining
          // runs with a space read "Full Stack" as "F u l l S t a c k" and nothing could be matched
          // against the file (toreview §131.8). A run that starts back left is a new piece too.
          else if (run.x - prev.end > em * WORD_GAP_EM || run.x < prev.x) pageText += ' ';
        }
        pageText += run.text;
        prev = run;
      }
      charsPerPage.push(pageText.replace(/\s+/g, '').length);
      lines.push(pageText.replace(/[ \t]+/g, ' ').trim());
      // The file's links: "LinkedIn" over https://linkedin.com/in/…, kept with the text they cover.
      try {
        const annotations = (await page.getAnnotations()) as { subtype?: string; url?: string; rect?: number[] }[];
        for (const a of annotations) {
          if (a.subtype !== 'Link' || typeof a.url !== 'string' || !/^(?:https:|mailto:|tel:)/i.test(a.url) || !a.rect || a.rect.length < 4) continue;
          const [x1, y1, x2, y2] = a.rect as [number, number, number, number];
          const under = runs.filter((r) => !r.hidden && r.x >= Math.min(x1, x2) - 2 && r.x <= Math.max(x1, x2) + 2 && r.y >= Math.min(y1, y2) - 3 && r.y <= Math.max(y1, y2) + 3);
          const text = under.map((r) => r.text).join(' ').replace(/\s+/g, ' ').trim();
          if (text) links.push({ text: text.slice(0, 200), url: a.url.slice(0, 500) });
        }
      } catch {
        // A file whose annotations cannot be read simply has no links.
      }
      geometry.push({
        width: vx1 - vx0,
        height: vy1 - vy0,
        lines: lineSegments(runs, vx0, vx1 - vx0),
        images: imageBoxes.map((b) => ({ width: b[2] - b[0], height: b[3] - b[1] })),
      });

      for (const { id, box } of pageImageIds) {
        // Large images arrive after the operator list; wait for each (bounded) rather than miss it.
        type Img = { width: number; height: number; kind: number; data: Uint8ClampedArray } | null;
        const obj = await Promise.race([
          new Promise<Img>((resolve) => page.objs.get(id, (value: unknown) => resolve(value as Img))),
          new Promise<Img>((resolve) => setTimeout(() => resolve(null), 5000)),
        ]);
        if (obj?.data && obj.width * obj.height >= 10_000) images.push({ page: p, width: obj.width, height: obj.height, kind: obj.kind, data: Uint8Array.from(obj.data), area: (box[2] - box[0]) * (box[3] - box[1]) });
      }
      page.cleanup();
    }
    return { pages: doc.numPages, text: lines.filter(Boolean).join('\n\n'), hidden, images, charsPerPage, geometry, links };
  } finally {
    await task.destroy();
  }
}
