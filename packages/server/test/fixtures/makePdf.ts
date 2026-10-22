import { deflateSync } from 'node:zlib';

/**
 * A minimal PDF writer for synthetic test fixtures (ImBackendImplementationPlan P7-04, P7-09). It
 * gives exact control over what the hidden-text detector must catch — the text render mode, the
 * fill colour, the font size and the position — which no generator library exposes. Synthetic only.
 */

export interface PdfRun {
  text: string;
  x: number;
  y: number;
  size?: number;
  /** 0 = fill (visible), 3 = invisible. */
  renderMode?: number;
  /** RGB 0–1; white by default would hide text on a white page. */
  color?: [number, number, number];
  /** How the run is placed: a `Td` move (the default) or a `Tm` text matrix, as many generators do. */
  place?: 'Td' | 'Tm';
}

export interface PdfImage {
  /** Raw 8-bit grayscale pixels, row by row. */
  gray: Uint8Array;
  width: number;
  height: number;
  /** Where to draw it, in points. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PdfPage {
  runs?: PdfRun[];
  image?: PdfImage;
  /** Page size in points; US Letter by default. */
  width?: number;
  height?: number;
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

export function makePdf(pages: PdfPage[]): Uint8Array {
  const objects: (string | Uint8Array)[] = [];
  const add = (body: string | Uint8Array) => {
    objects.push(body);
    return objects.length;
  };
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const pagesId = objects.length + 1;
  objects.push(''); // the Pages tree, filled in below
  const kids: number[] = [];

  for (const page of pages) {
    const width = page.width ?? 612;
    const height = page.height ?? 792;
    let content = '';
    let imageRef = '';
    if (page.image) {
      const img = page.image;
      const packed = deflateSync(img.gray);
      const head = `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${packed.length} >>\nstream\n`;
      const id = add(concat(enc(head), packed, enc('\nendstream')));
      imageRef = `/XObject << /Im1 ${id} 0 R >>`;
      content += `q ${img.w} 0 0 ${img.h} ${img.x} ${img.y} cm /Im1 Do Q\n`;
    }
    for (const run of page.runs ?? []) {
      const [r, g, b] = run.color ?? [0, 0, 0];
      content += `BT ${run.renderMode ?? 0} Tr ${r} ${g} ${b} rg /F1 ${run.size ?? 11} Tf ${run.place === 'Tm' ? `1 0 0 1 ${run.x} ${run.y} Tm` : `${run.x} ${run.y} Td`} (${esc(run.text)}) Tj ET\n`;
    }
    const contentId = add(`<< /Length ${content.length} >>\nstream\n${content}endstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${width} ${height}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${font} 0 R >> ${imageRef} >> >>`));
  }
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  const catalog = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  const parts: Uint8Array[] = [enc('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')];
  const offsets: number[] = [];
  let length = parts[0]!.length;
  objects.forEach((body, i) => {
    offsets.push(length);
    const chunk = concat(enc(`${i + 1} 0 obj\n`), typeof body === 'string' ? enc(body) : body, enc('\nendobj\n'));
    parts.push(chunk);
    length += chunk.length;
  });
  const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${length}\n%%EOF\n`;
  parts.push(enc(xref));
  return concat(...parts);
}

function enc(s: string): Uint8Array {
  // Latin-1, byte per char, as PDF syntax expects.
  return Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
}

function concat(...chunks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
