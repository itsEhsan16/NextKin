import { strToU8, zipSync, type Zippable } from 'fflate';

/**
 * A minimal DOCX writer for synthetic fixtures (P7-04, P7-09): paragraphs of runs with the
 * properties the hidden-text detector must read — hidden (`w:vanish`), colour, shading and size.
 */
export interface DocxRun {
  text: string;
  vanish?: boolean;
  /** Hex, e.g. 'FFFFFF'. */
  color?: string;
  /** Background shading behind the run, hex. */
  shading?: string;
  /** Half-points (22 = 11pt). */
  size?: number;
}

const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function makeDocx(paragraphs: DocxRun[][], options: { doctype?: string; extra?: Zippable } = {}): Uint8Array {
  const body = paragraphs
    .map((runs) => {
      const xml = runs
        .map((run) => {
          const props = [
            run.vanish ? '<w:vanish/>' : '',
            run.color ? `<w:color w:val="${run.color}"/>` : '',
            run.shading ? `<w:shd w:val="clear" w:color="auto" w:fill="${run.shading}"/>` : '',
            run.size ? `<w:sz w:val="${run.size}"/>` : '',
          ].join('');
          return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${escapeXml(run.text)}</w:t></w:r>`;
        })
        .join('');
      return `<w:p>${xml}</w:p>`;
    })
    .join('');
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${options.doctype ?? ''}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
  return zipSync({
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    'word/document.xml': strToU8(document),
    ...options.extra,
  });
}
