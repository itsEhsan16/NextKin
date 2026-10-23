import { createHash } from 'node:crypto';

import { loadConfig } from '../config';
import { certifyTemplate, CERTIFICATION_RESUME } from '../export/certify';
import { resumeModel } from '../export/model';
import { createPdfRenderer } from '../export/renderPdf';
import { CLASSIC, TWO_COLUMN_TEST } from '../export/templates';

/**
 * The export proof inside the worker image (ImBackendImplementationPlan P10-04, P10-06; replaces the
 * P1-07 Chromium smoke test). With the bundled Chromium and fonts it checks that:
 * - the same document renders to byte-identical PDFs, in under 10 seconds each;
 * - NextKin Classic certifies in all three formats;
 * - the two-column test template fails.
 * It prints the PDF's hash, so two images, or two machines, can be compared.
 */

/** `--chromium=<path>`, else CHROMIUM_PATH from the config when there is one, else the image's own build. */
function chromiumPath(): string | undefined {
  const flag = process.argv.find((a) => a.startsWith('--chromium='));
  if (flag) return flag.slice('--chromium='.length);
  try {
    return loadConfig().CHROMIUM_PATH;
  } catch {
    return undefined; // a bare image has no database config, and needs none to render
  }
}

const executablePath = chromiumPath();
const pdf = createPdfRenderer(executablePath ? { executablePath } : {});
try {
  const html = CLASSIC.html(resumeModel(CERTIFICATION_RESUME, { name: 'Alex Example', email: 'alex@example.com' }));
  const stamp = new Date('2026-01-01T00:00:00Z');
  const times: number[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < 3; i++) {
    const started = Date.now();
    const bytes = await pdf.render(html, stamp);
    times.push(Date.now() - started);
    hashes.push(createHash('sha256').update(bytes).digest('hex'));
  }
  if (new Set(hashes).size !== 1) throw new Error(`PDFs differ between runs: ${hashes.join(', ')}`);
  if (Math.max(...times) >= 10_000) throw new Error(`a render took ${Math.max(...times)} ms`);
  const classic = await certifyTemplate(CLASSIC, pdf);
  if (!classic.certified) throw new Error(`NextKin Classic failed certification: ${JSON.stringify(classic.results)}`);
  const twoColumn = await certifyTemplate(TWO_COLUMN_TEST, pdf);
  if (twoColumn.results.pdf.ok) throw new Error('the two-column test template passed parse-back; certification is not measuring layout');
  console.log(`render-check ok: sha256 ${hashes[0]} · renders ${times.join('/')} ms · classic certified · two-column rejected (${twoColumn.results.pdf.sectionsLost.length} sections lost)`);
} finally {
  await pdf.close();
}
