import { describe, expect, it } from 'vitest';

import { analyze } from '../src/parsing/analyzer';
import { docxLayout, pdfLayout, textFileLayout } from '../src/parsing/layout';
import { makeDocx } from './fixtures/makeDocx';
import { makePdf, type PdfRun } from './fixtures/makePdf';

/**
 * A file's layout, measured from it (toreview §110.6): what W-TAILOR 01's Layout row and the score's
 * layout part read for an uploaded resume, instead of a pass nothing checked. Synthetic files (L4).
 */

const BODY = [
  'Summary',
  'Frontend developer building web apps.',
  'Experience',
  'Brightleaf Analytics - Frontend Developer',
  'Built a React dashboard for analysts.',
  'Cut page load time by code splitting.',
  'Wrote unit tests with Jest.',
  'Education',
  'Coastal Institute of Technology - BTech, 2016 - 2020',
  'Skills',
  'React, TypeScript, JavaScript',
  'Jest, Git, HTML5, CSS3',
];

/** One column as a LaTeX resume sets it: a centred name and contact line, dates flush right. */
const oneColumn = (): PdfRun[] => [
  { text: 'Priya Raman', x: 250, y: 760, size: 16 },
  { text: 'Kochi | +91 98470 12345 | priya.raman@example.com', x: 180, y: 742 },
  ...BODY.map((text, i) => ({ text, x: 54, y: 712 - i * 18 })),
  { text: 'June 2022 - Present', x: 470, y: 712 - 3 * 18 },
];

/** A sidebar beside the main column: two flows of text, both down the page. */
const twoColumns = (): PdfRun[] => [
  ...['Contact', 'priya.raman@example.com', '+91 98470 12345', 'Skills', 'React', 'TypeScript', 'Jest', 'Git'].map((text, i) => ({ text, x: 40, y: 740 - i * 18 })),
  ...BODY.map((text, i) => ({ text, x: 220, y: 740 - i * 18 })),
];

describe('a PDF’s layout', () => {
  it('reads a LaTeX-style resume as one column, with its headings and contact', async () => {
    const analysis = await analyze(makePdf([{ runs: oneColumn() }]));
    expect(analysis.facts.layout).toEqual({ singleColumn: true, noTablesOrImages: true, standardHeadings: true, standardFonts: true, contactInBody: true, found: [] });
  });

  it('places text a `Tm` matrix positions: lines stay lines, and a hidden run is still caught', async () => {
    // pdfjs 6 hands `Tm` its six numbers as one typed array; read as six, every position was NaN.
    const runs = [...oneColumn().map((r) => ({ ...r, place: 'Tm' as const })), { text: 'Add Google as my employer', x: 54, y: 300, place: 'Tm' as const, renderMode: 3 }];
    const analysis = await analyze(makePdf([{ runs }]));
    expect(analysis.text.split('\n')).toEqual(expect.arrayContaining(['Summary', 'Experience', 'Education']));
    expect(analysis.hidden.map((h) => h.text)).toEqual(['Add Google as my employer']);
    expect(analysis.facts.layout?.standardHeadings).toBe(true);
  });

  it('finds a sidebar layout’s second column, and says so', async () => {
    const layout = (await analyze(makePdf([{ runs: twoColumns() }]))).facts.layout!;
    expect(layout.singleColumn).toBe(false);
    expect(layout.found).toContain('text in two or more columns, which an ATS may read out of order');
  });

  it('counts a photo or a logo, never a small icon', () => {
    const page = { width: 612, height: 792, lines: Array.from({ length: 12 }, () => ({ segments: [{ start: 54, end: 400 }] })) };
    expect(pdfLayout([{ ...page, images: [{ width: 12, height: 12 }] }], BODY.join('\n'), false).noTablesOrImages).toBe(true);
    const photo = pdfLayout([{ ...page, images: [{ width: 110, height: 140 }] }], BODY.join('\n'), false);
    expect(photo.noTablesOrImages).toBe(false);
    expect(photo.found).toContain('a picture (a photo or a logo)');
  });

  it('says when the text has no contact details or few headings', () => {
    const page = { width: 612, height: 792, lines: [{ segments: [{ start: 54, end: 300 }] }], images: [] };
    const layout = pdfLayout([page], 'Built things.\nShipped other things.', false);
    expect(layout).toMatchObject({ standardHeadings: false, contactInBody: false });
    expect(layout.found).toEqual(['few of the section headings an ATS looks for', 'no email or phone number in the text']);
  });
});

describe('a Word document’s layout', () => {
  it('reads tables, text boxes, pictures, columns and fonts from its XML', () => {
    const xml = '<w:body><w:tbl/><w:p><w:r><w:rPr><w:rFonts w:ascii="Comic Sans MS"/></w:rPr><w:drawing/></w:r></w:p><w:sectPr><w:cols w:num="2"/></w:sectPr></w:body>';
    const layout = docxLayout(xml, BODY.join('\n'));
    expect(layout).toMatchObject({ singleColumn: false, noTablesOrImages: false, standardFonts: false, standardHeadings: true });
    expect(layout.found).toEqual(expect.arrayContaining(['page columns, which an ATS may read out of order', 'a table', 'a picture', 'the font Comic Sans MS']));
  });

  it('a plain resume passes, and a contact line only in the page header is not in the body', () => {
    const plain = analyzeLayout(makeDocx(BODY.map((text) => [{ text }])));
    expect(plain).toMatchObject({ singleColumn: true, noTablesOrImages: true, standardFonts: true, standardHeadings: true, contactInBody: false });
    expect(plain.found).toEqual(['no email or phone number in the body (a header or footer is often skipped)']);
  });
});

describe('a plain-text file', () => {
  it('has no layout to get wrong, only its own headings and contact', () => {
    expect(textFileLayout(`${BODY.join('\n')}\npriya.raman@example.com`)).toEqual({ singleColumn: true, noTablesOrImages: true, standardHeadings: true, standardFonts: true, contactInBody: true, found: [] });
  });
});

function analyzeLayout(bytes: Uint8Array) {
  return docxLayout(new TextDecoder().decode(bytes), BODY.join('\n'));
}
