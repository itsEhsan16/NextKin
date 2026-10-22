import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium, type Browser } from 'playwright-core';

import { FONT_ORIGIN } from './templates';

/**
 * PDF rendering (ImBackendImplementationPlan P10-04; V2 §7.12, §9.7). Headless Chromium in the
 * worker, one browser kept warm across jobs. Every page renders with JavaScript off and every
 * request refused except the bundled fonts, so a template can load nothing from anywhere.
 *
 * Output is byte-identical for the same HTML and stamp: Chromium writes the render time into the
 * PDF's metadata, and that one field is replaced, digit for digit, with the version's own time, so
 * no offset in the file moves.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

/** assets/fonts beside the source in development, beside the bundle in the image. */
export function fontsDir(): string {
  const candidates = [resolve(HERE, '../../assets/fonts'), resolve(HERE, 'assets/fonts'), resolve(process.cwd(), 'assets/fonts')];
  const found = candidates.find((dir) => existsSync(join(dir, 'LiberationSans-Regular.ttf')));
  if (!found) throw new Error(`The export fonts are missing (looked in ${candidates.join(', ')}).`);
  return found;
}

const fontCache = new Map<string, Buffer>();
function font(name: string): Buffer | null {
  if (!/^[A-Za-z0-9-]+\.ttf$/.test(name)) return null;
  if (!fontCache.has(name)) {
    const file = join(fontsDir(), name);
    if (!existsSync(file)) return null;
    fontCache.set(name, readFileSync(file));
  }
  return fontCache.get(name)!;
}

export interface PdfRenderer {
  render(html: string, stamp: Date): Promise<Uint8Array>;
  close(): Promise<void>;
}

/** "D:20261012093000" for the metadata dates, in UTC. */
const pdfDate = (d: Date) => `D:${d.toISOString().replace(/[-:T]/g, '').slice(0, 14)}`;

/** Replaces the render time Chromium stamps (CreationDate, ModDate) with `stamp`, keeping every length. */
export function fixPdfDates(pdf: Uint8Array, stamp: Date): Uint8Array {
  const text = Buffer.from(pdf).toString('latin1');
  const fixed = text.replace(/\/(CreationDate|ModDate)\s*\(D:(\d{14})/g, (match, _key: string, digits: string) => match.slice(0, match.length - digits.length - 2) + pdfDate(stamp));
  return new Uint8Array(Buffer.from(fixed, 'latin1'));
}

export function createPdfRenderer(options: { executablePath?: string } = {}): PdfRenderer {
  let browser: Promise<Browser> | null = null;

  const launch = () => {
    const started = chromium.launch({ ...(options.executablePath ? { executablePath: options.executablePath } : {}), args: ['--no-sandbox', '--font-render-hinting=none', '--disable-lcd-text'] });
    // A browser that dies between jobs is relaunched on the next one.
    started.then((b) => b.on('disconnected', () => (browser = null))).catch(() => (browser = null));
    return started;
  };

  return {
    async render(html, stamp) {
      browser ??= launch();
      // A fixed user agent: Chromium writes it into the PDF's Creator, and the host's OS must not show.
      const context = await (await browser).newContext({ javaScriptEnabled: false, userAgent: 'NextKin Export' });
      try {
        const page = await context.newPage();
        await page.route('**/*', async (route) => {
          const url = route.request().url();
          if (url.startsWith(`${FONT_ORIGIN}/`)) {
            const body = font(url.slice(FONT_ORIGIN.length + 1));
            if (body) return route.fulfill({ status: 200, contentType: 'font/ttf', body });
          }
          return route.abort('blockedbyclient');
        });
        await page.setContent(html, { waitUntil: 'load' });
        const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, tagged: true, outline: false });
        return fixPdfDates(pdf, stamp);
      } finally {
        await context.close();
      }
    },
    async close() {
      if (browser) await (await browser).close().catch(() => undefined);
      browser = null;
    },
  };
}
