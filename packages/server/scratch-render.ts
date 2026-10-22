import { certifyTemplate } from './src/export/certify';
import { createPdfRenderer } from './src/export/renderPdf';
import { CLASSIC, TWO_COLUMN_TEST } from './src/export/templates';
const r = createPdfRenderer({ executablePath: process.env.CHROMIUM_PATH });
for (const t of [CLASSIC, TWO_COLUMN_TEST]) {
  const c = await certifyTemplate(t, r);
  console.log(t.slug, 'certified', c.certified, Object.fromEntries(Object.entries(c.results).map(([k, v]) => [k, { ok: v.ok, missing: v.missing.length, outOfOrder: v.outOfOrder.length, lost: v.sectionsLost }])));
  if (!c.results.pdf.ok) console.log('  e.g.', c.results.pdf.missing.slice(0, 2), c.results.pdf.outOfOrder.slice(0, 2));
}
await r.close();
