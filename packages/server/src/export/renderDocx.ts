import { AlignmentType, BorderStyle, Document, HeadingLevel, LevelFormat, Packer, Paragraph, TextRun } from 'docx';

import { SEPARATOR, type RenderModel } from './model';

/**
 * DOCX export (ImBackendImplementationPlan P10-05; V2 §7.12) with `docx` 9.7, from the same render
 * model as the PDF. It declares Arial, the font Liberation Sans stands in for in the PDF, so the
 * file lays out the same on the recipient's machine. Real headings and a real bullet list, no
 * tables, text boxes, images, headers or footers: nothing a parser would miss.
 */

const FONT = 'Arial';
const BODY = 21; // half-points: 10.5pt, as the PDF

const run = (text: string, extra: { bold?: boolean; size?: number; color?: string } = {}) => new TextRun({ text, font: FONT, size: extra.size ?? BODY, ...(extra.bold ? { bold: true } : {}), ...(extra.color ? { color: extra.color } : {}) });

export async function renderDocx(model: RenderModel): Promise<Uint8Array> {
  const children: Paragraph[] = [new Paragraph({ children: [run(model.name, { bold: true, size: 38 })], spacing: { after: 40 } })];
  if (model.headline) children.push(new Paragraph({ children: [run(model.headline, { bold: true, size: 22 })], spacing: { after: 40 } }));
  if (model.contact.length) children.push(new Paragraph({ children: [run(model.contact.join(SEPARATOR), { color: '374151' })], spacing: { after: 120 } }));

  for (const section of model.sections) {
    if (section.heading) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [run(section.heading, { bold: true, size: 22, color: '111827' })],
          spacing: { before: 240, after: 80 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '9CA3AF', space: 2 } },
        }),
      );
    }
    for (const block of section.blocks) {
      if (block.kind === 'paragraph') {
        children.push(new Paragraph({ children: [run(block.text)], spacing: { after: 100 } }));
        continue;
      }
      children.push(new Paragraph({ children: [run(block.title, { bold: true })], spacing: { after: 0 }, keepNext: true }));
      if (block.subtitle) children.push(new Paragraph({ children: [run(block.subtitle, { bold: true })], spacing: { after: 0 }, keepNext: true }));
      if (block.meta) children.push(new Paragraph({ children: [run(block.meta, { color: '374151' })], spacing: { after: 40 }, keepNext: block.bullets.length > 0 }));
      for (const bullet of block.bullets) children.push(new Paragraph({ children: [run(bullet)], numbering: { reference: 'bullets', level: 0 }, spacing: { after: 40 } }));
    }
  }

  const doc = new Document({
    creator: 'NextKin',
    title: model.name,
    styles: { default: { document: { run: { font: FONT, size: BODY } } } },
    numbering: {
      config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] }],
    },
    // A4 or US Letter by where the person is (toreview §130); margins about two thirds of an inch.
    sections: [{ properties: { page: { size: model.paper === 'letter' ? { width: 12240, height: 15840 } : { width: 11906, height: 16838 }, margin: { top: 964, bottom: 964, left: 964, right: 964 } } }, children }],
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}
