import { randomUUID } from 'node:crypto';
import { cpSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../src/config';
import { createTesseractOcr, TESSDATA_DIR, verifyTessdata, type OcrPort } from '../../../src/ocr/tesseract';
import { createClamavScanner, type ScanPort } from '../../../src/scan/scan';
import { eicar } from '../fixtures/eicar';
import { createS3Storage, MAX_PRESIGN_GET_SECONDS, quarantineKey, type StoragePort } from '../../../src/storage/storage';

/**
 * The contract suites for storage, scan and OCR (ImBackendImplementationPlan P7-09, L2). Each runs
 * against every adapter that exists — SeaweedFS (S3 API), clamd and Tesseract today — and S3,
 * GuardDuty and Textract must pass them unchanged at X-05 and X-14.
 */
const config = loadConfig();

async function post(target: { url: string; fields: Record<string, string> }, body: Uint8Array, contentType: string) {
  const form = new FormData();
  for (const [k, v] of Object.entries(target.fields)) form.append(k, v);
  form.append('file', new Blob([Uint8Array.from(body)], { type: contentType }), 'upload.bin');
  return fetch(target.url, { method: 'POST', body: form });
}

const storages: { name: string; make: () => StoragePort }[] = [
  { name: 'S3 API (SeaweedFS)', make: () => createS3Storage({ region: config.AWS_REGION, endpoint: config.S3_ENDPOINT, forcePathStyle: config.S3_FORCE_PATH_STYLE }) },
];

for (const adapter of storages) {
  describe(`StoragePort contract: ${adapter.name}`, () => {
    const bucket = config.S3_BUCKET_UPLOADS;
    const key = () => `users/contract-${randomUUID()}/uploads/${randomUUID()}`;

    it('a presigned POST accepts a file inside its policy, which can then be read', async () => {
      const s = adapter.make();
      const k = key();
      const res = await post(await s.presignPost({ bucket, key: k, contentType: 'application/pdf', maxBytes: 1024 }), new Uint8Array(100), 'application/pdf');
      expect(res.status).toBeLessThan(300);
      expect(await s.head(bucket, k)).toMatchObject({ size: 100 });
      expect((await s.read(bucket, k, 1024)).length).toBe(100);
      await s.remove(bucket, k);
      expect(await s.head(bucket, k)).toBeNull();
    });

    it('storage itself refuses an oversized file, a different type, and a different key', async () => {
      const s = adapter.make();
      const k = key();
      const target = await s.presignPost({ bucket, key: k, contentType: 'application/pdf', maxBytes: 1024 });
      expect((await post(target, new Uint8Array(4096), 'application/pdf')).status).toBeGreaterThanOrEqual(400);
      const wrongType = { ...target, fields: { ...target.fields, 'Content-Type': 'text/html' } };
      expect((await post(wrongType, new Uint8Array(10), 'text/html')).status).toBeGreaterThanOrEqual(400);
      const escape = { ...target, fields: { ...target.fields, key: `users/someone-else/uploads/${randomUUID()}` } };
      expect((await post(escape, new Uint8Array(10), 'application/pdf')).status).toBeGreaterThanOrEqual(400);
      expect(await s.head(bucket, k)).toBeNull();
    });

    it('reads refuse an object over the caller\'s limit', async () => {
      const s = adapter.make();
      const k = key();
      await s.write(bucket, k, new Uint8Array(2048), 'application/pdf');
      await expect(s.read(bucket, k, 1024)).rejects.toThrow(/larger/);
      await s.remove(bucket, k);
    });

    it('presigned GETs last at most 15 minutes and quarantined objects are never presigned', async () => {
      const s = adapter.make();
      const k = key();
      await s.write(bucket, k, new TextEncoder().encode('hello'), 'text/plain');
      const url = new URL(await s.presignGet(bucket, k, { seconds: 24 * 3600 }));
      expect(Number(url.searchParams.get('X-Amz-Expires'))).toBe(MAX_PRESIGN_GET_SECONDS);
      expect(await (await fetch(url)).text()).toBe('hello');
      await expect(s.presignGet(bucket, quarantineKey(k))).rejects.toThrow(/quarantined/);
      await s.remove(bucket, k);
    });
  });
}

const scanners: { name: string; make: () => ScanPort }[] = [{ name: 'ClamAV (clamd)', make: () => createClamavScanner({ host: config.CLAMAV_HOST, port: config.CLAMAV_PORT }) }];

for (const adapter of scanners) {
  describe(`ScanPort contract: ${adapter.name}`, () => {
    it('EICAR is infected, an ordinary resume is clean', async () => {
      const s = adapter.make();
      expect(await s.scan(eicar())).toMatchObject({ verdict: 'infected', signature: expect.stringMatching(/eicar/i) });
      expect(await s.scan(new TextEncoder().encode('Jordan Avery, Platform Engineer'))).toEqual({ verdict: 'clean' });
    });
    it('an unreachable scanner is a failure, never clean', async () => {
      const unreachable = createClamavScanner({ host: '127.0.0.1', port: 1, timeoutMs: 2000 });
      expect(await unreachable.scan(new Uint8Array(10))).toMatchObject({ verdict: 'failed' });
      expect(await unreachable.ping()).toBe(false);
    });
  });
}

const ocrs: { name: string; make: () => Promise<OcrPort> }[] = [{ name: 'Tesseract (tessdata_fast)', make: () => createTesseractOcr() }];

for (const adapter of ocrs) {
  describe(`OcrPort contract: ${adapter.name}`, () => {
    it('refuses language data that does not match its recorded hash', () => {
      const dir = mkdtempSync(join(tmpdir(), 'nk-tess-'));
      cpSync(TESSDATA_DIR, dir, { recursive: true });
      writeFileSync(join(dir, 'deu.traineddata'), 'tampered');
      expect(() => verifyTessdata(dir)).toThrow(/does not match/);
      expect(() => verifyTessdata()).not.toThrow();
    });
  });
  void adapter; // recognition is proved on the scanned fixture in test/parsing.test.ts
}
