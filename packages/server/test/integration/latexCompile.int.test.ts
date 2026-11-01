import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it } from 'vitest';

import { MARKETS } from '@nextkin/engines/markets';

import { CERTIFICATION_RESUME } from '../../src/export/certify';
import { createLatexCompiler } from '../../src/export/latex/compile';
import { resumeModel } from '../../src/export/model';
import { pdfReadingText, receiptOf } from '../../src/export/parseBack';
import { sourceOf } from '../../src/services/renders';
import { latexResumeOf } from '../../src/export/latex/fromCanonical';
import { texOf } from '../../src/export/latex/jakeTemplate';
import { warmupResume } from '../../src/export/latex/warmupSources';
import { crossCheck } from '../../src/parsing/extract';
import { splitHeader } from '../../src/parsing/header';
import { EXTRACTION, LINKS, TEXT } from '../fixtures/structuredResume';

/**
 * toreview §111: a real compile through the sealed service (`pnpm stack:up -- --profile latex`),
 * reached from the host through latex-relay on 127.0.0.1:8790. Skipped when it is not running.
 */

const URL_ = 'http://127.0.0.1:8790';
const TOKEN_FILE = join(import.meta.dirname, '../../../../docker/latex/dev.token');

const up = await fetch(`${URL_}/health`, { signal: AbortSignal.timeout(1000) })
  .then((r) => r.ok)
  .catch(() => false);
const ready = up && existsSync(TOKEN_FILE);

const compiler = () => createLatexCompiler({ LATEX_COMPILER_URL: URL_, LATEX_COMPILER_TOKEN_FILE: TOKEN_FILE }, { fetch });

describe.skipIf(!ready)('the LaTeX compile service (latex profile)', () => {
  it('compiles a one-page Jake-style resume into a PDF and one PNG', async () => {
    const result = await compiler().compile(texOf(warmupResume(0, 'letter')));
    expect(Buffer.from(result.pdf.subarray(0, 5)).toString()).toBe('%PDF-');
    expect(result.pages).toBe(1);
    expect(result.pngs).toHaveLength(1);
    expect(Buffer.from(result.pngs[0]?.subarray(1, 4) ?? []).toString()).toBe('PNG');
  });

  it('keeps an uploaded one-pager on one page, with every contact link live', async () => {
    const { header, body } = splitHeader(TEXT, LINKS);
    const { document } = crossCheck(EXTRACTION, body);
    const result = await compiler().compile(texOf(latexResumeOf({ ...document, ...(header ? { header } : {}) }, { name: 'Account' })));
    expect(result.pages).toBe(1);
    const page = await (await getDocument({ data: new Uint8Array(result.pdf) }).promise).getPage(1);
    const links = (await page.getAnnotations()).filter((a: { subtype: string }) => a.subtype === 'Link').map((a: { url?: string }) => a.url);
    // XeTeXinterwordspaceshaping=2 once kept only the first of these (toreview §111.4).
    expect(links).toEqual(['tel:+919847012345', 'mailto:alex.rivera@example.com', 'https://www.linkedin.com/in/alex-rivera', 'https://github.com/alexrivera']);
  });

  // The receipt says what a real typeset page reads back as, in each of the page designs.
  it.each(['jake', 'modern', 'elegant'] as const)('reads a typeset %s resume back whole (toreview §146.6)', async (template) => {
    const doc = { ...CERTIFICATION_RESUME, template };
    const who = { name: 'Alex Rivera', email: 'alex.rivera@example.com', phone: '+91 98470 12345', location: 'Bengaluru' };
    const { tex } = sourceOf(doc, who, { density: 0, paper: 'letter', market: MARKETS.profiles.us });
    const { pdf } = await compiler().compile(tex);
    const model = resumeModel(doc, who);
    const receipt = receiptOf(model, await pdfReadingText(pdf));
    expect(receipt.bullets.total).toBeGreaterThan(0);
    expect(receipt.bullets.found).toBe(receipt.bullets.total);
    expect(receipt.sections.found).toBe(receipt.sections.total);
  });

  it('answers a broken source with a compile failure and Tectonic’s log', async () => {
    const err = await compiler().compile('\\documentclass{article}\\begin{document}\\nosuchmacro\\end{document}').catch((e: unknown) => e);
    expect(err).toMatchObject({ kind: 'compile' });
    expect((err as { log: string[] }).log.join('\n')).toMatch(/Undefined control sequence/);
  });
});
