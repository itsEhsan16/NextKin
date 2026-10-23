import { paperForLocation, type MarketProfile } from '@nextkin/engines/markets';
import type { CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';

import type { LatexCompiler } from '../export/latex/compile';
import { styleOf } from '../export/latex/styles';
import type { Identity as Who } from '../export/model';
import { isStandardFont, type FileLayout } from '../parsing/layout';
import { analyzeIsolated } from '../parsing/pool';
import { renderTemplateOf, sourceOf, type RenderDeps } from './renders';

/** A typeset PDF is a page or two of text; anything near this is not one of ours. */
const MAX_PDF_BYTES = 10 * 1024 * 1024;

/**
 * A resume version's PDF for download (toreview §111): the newest ready render of the version,
 * read back from storage, so the file is the pages its preview showed. When none is ready yet the
 * version is compiled here at the template's own density.
 */
export async function typesetPdf(deps: RenderDeps & { latex: LatexCompiler }, userId: string, versionId: string, doc: CanonicalResumeJson, who: Who, market: MarketProfile): Promise<Uint8Array> {
  const template = renderTemplateOf(doc);
  const ready = await deps.db.withUser({ userId, role: 'user' }, (tx) =>
    tx
      .selectFrom('resume_renders')
      .select(['pdf_key'])
      .where('resume_version_id', '=', versionId)
      .where('template_slug', '=', template.slug)
      .where('template_rev', '=', template.rev)
      .where('status', '=', 'ready')
      .orderBy('completed_at', 'desc')
      .executeTakeFirst(),
  );
  if (ready?.pdf_key) return deps.storage.read(deps.bucket, ready.pdf_key, MAX_PDF_BYTES);
  const source = sourceOf(doc, who, { density: 0, paper: paperForLocation(who.location), market });
  if (!source.lint.ok) throw new Error(`the template wrote TeX the lint refused: ${source.lint.problems.slice(0, 3).join('; ')}`);
  return (await deps.latex.compile(source.tex)).pdf;
}

/**
 * Reads a typeset resume back the way an upload is read (toreview §130, G18): one column, no
 * images, standard headings, contact in the body, measured from the PDF itself; the font is the
 * template's own, which must be a standard one. A failed read makes no claim either way.
 */
export async function readBackTypeset(pdf: Uint8Array, template: string | undefined): Promise<{ ok: boolean; layout: FileLayout } | null> {
  try {
    const analysis = await analyzeIsolated(pdf, { allowed: ['pdf'] });
    const measured = analysis.facts.layout;
    if (!measured) return null;
    const font = styleOf(template).fontName;
    const standardFonts = measured.standardFonts && isStandardFont(font);
    const layout: FileLayout = { ...measured, standardFonts, found: [...measured.found, ...(standardFonts ? [] : [`the font ${font}`])] };
    const ok = layout.singleColumn && layout.noTablesOrImages && layout.standardHeadings && layout.standardFonts && layout.contactInBody;
    return { ok, layout };
  } catch {
    return null;
  }
}
