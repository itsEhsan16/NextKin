import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorker } from 'tesseract.js';

/**
 * The OCR port and its Tesseract adapter (ImBackendImplementationPlan P7-06). tesseract.js runs the
 * same WASM build on the Windows host, in CI and in the worker image, with the `tessdata_fast`
 * English and German models vendored in `vendor/tessdata` and checked against their recorded hashes
 * before use, so nothing is downloaded at run time. Textract replaces it at X-14 behind this port.
 */

export interface OcrResult {
  text: string;
  /** Tesseract's mean word confidence, 0–100. */
  confidence: number;
}

export interface OcrPort {
  recognise(png: Buffer): Promise<OcrResult>;
  close(): Promise<void>;
}

// From the source (src/ocr) the models are two folders up; from the worker image's bundle (dist) one.
// Not import.meta.dirname: Next's bundle leaves it undefined.
const HERE = dirname(fileURLToPath(import.meta.url));
export const TESSDATA_DIR = [join(HERE, '../../vendor/tessdata'), join(HERE, '../vendor/tessdata')].find((dir) => existsSync(dir)) ?? join(HERE, '../../vendor/tessdata');
export const TESSDATA_SHA256: Record<'eng' | 'deu', string> = {
  eng: '7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2',
  deu: '19d219bbb6672c869d20a9636c6816a81eb9a71796cb93ebe0cb1530e2cdb22d',
};

export function verifyTessdata(dir = TESSDATA_DIR): void {
  for (const [lang, expected] of Object.entries(TESSDATA_SHA256)) {
    const actual = createHash('sha256').update(readFileSync(join(dir, `${lang}.traineddata`))).digest('hex');
    if (actual !== expected) throw new Error(`vendor/tessdata/${lang}.traineddata does not match its recorded hash`);
  }
}

export async function createTesseractOcr(options: { dir?: string } = {}): Promise<OcrPort> {
  const dir = options.dir ?? TESSDATA_DIR;
  verifyTessdata(dir);
  // OEM 1 = the LSTM engine the fast models are trained for. No cache: the models are local files.
  const worker = await createWorker(['eng', 'deu'], 1, { langPath: dir, gzip: false, cacheMethod: 'none' });
  return {
    async recognise(png) {
      const { data } = await worker.recognize(png);
      return { text: data.text.replace(/[ \t]+/g, ' ').trim(), confidence: data.confidence };
    },
    close: async () => {
      await worker.terminate();
    },
  };
}
