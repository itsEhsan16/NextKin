/**
 * Regenerates `scanned-resume.pdf`: a synthetic resume drawn as pixels, with no text layer, the way a
 * scanner or a phone photo produces one (P7-06). Text is painted on a canvas in a local Chromium and
 * the grayscale pixels are embedded as one page image.
 *
 *   PLAYWRIGHT_CHROMIUM=<path to chrome.exe> npx tsx test/fixtures/generate-scanned.ts
 *
 * Synthetic data only (L4): the person, employers and dates are invented.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { makePdf } from './makePdf';

export const SCANNED_LINES = [
  'Jordan Avery',
  'Platform Engineer',
  '',
  'EXPERIENCE',
  'Northwind Logistics - Senior Platform Engineer',
  'March 2021 - Present',
  'Built deployment pipelines with Kubernetes and Terraform.',
  '',
  'Contoso Retail - Software Engineer',
  'June 2017 - February 2021',
  'Developed order services in Go and PostgreSQL.',
  '',
  'EDUCATION',
  'Riverside Technical University - BSc Computer Science',
  '2013 - 2017',
];

const WIDTH = 1275; // US Letter at 150 dpi
const HEIGHT = 1650;

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM });
const page = await browser.newPage();
const gray: number[] = await page.evaluate(
  ({ lines, width, height }) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#111';
    lines.forEach((line, i) => {
      ctx.font = i === 0 ? 'bold 40px Arial' : /^[A-Z]+$/.test(line) ? 'bold 30px Arial' : '28px Arial';
      ctx.fillText(line, 110, 150 + i * 48);
    });
    const { data } = ctx.getImageData(0, 0, width, height);
    const out: number[] = new Array(width * height);
    for (let i = 0; i < width * height; i++) out[i] = data[i * 4]!;
    return out;
  },
  { lines: SCANNED_LINES, width: WIDTH, height: HEIGHT },
);
await browser.close();

const pdf = makePdf([{ image: { gray: Uint8Array.from(gray), width: WIDTH, height: HEIGHT, x: 0, y: 0, w: 612, h: 792 } }]);
const target = join(import.meta.dirname, 'scanned-resume.pdf');
writeFileSync(target, pdf);
console.log(`wrote ${target} (${pdf.length} bytes)`);
