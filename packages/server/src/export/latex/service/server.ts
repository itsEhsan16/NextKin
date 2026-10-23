import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import type { RunResult } from './run';

/**
 * The compile service's HTTP surface (toreview §111). Two routes:
 *   GET  /health   200 when the process is up
 *   POST /compile  Authorization: Bearer <token>, body = UTF-8 .tex (at most maxBytes)
 *     200 { pdf, pages, pngs, ms }  pdf and each png base64
 *     400 not UTF-8 or empty        401 bad or missing token      413 body too large
 *     422 { error, log }            Tectonic failed; its last log lines, with no paths
 *     503 busy (Retry-After)        504 the compile passed its wall-clock limit
 */

export interface ServiceOptions {
  token: string;
  maxBytes: number;
  concurrency: number;
  queue: number;
  compile: (tex: string) => Promise<RunResult>;
  log?: (event: Record<string, unknown>) => void;
}

const digest = (s: string) => createHash('sha256').update(s).digest();

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(json), 'cache-control': 'no-store', ...headers });
  res.end(json);
}

class TooLarge extends Error {}

function readBody(req: IncomingMessage, max: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] ?? NaN);
    if (Number.isFinite(declared) && declared > max) return reject(new TooLarge());
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > max) {
        req.destroy();
        reject(new TooLarge());
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** A counting semaphore with a bounded queue: `acquire` resolves false when the queue is full. */
function limiter(concurrency: number, queue: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return {
    async acquire(): Promise<boolean> {
      if (active < concurrency) {
        active++;
        return true;
      }
      if (waiting.length >= queue) return false;
      await new Promise<void>((r) => waiting.push(r));
      return true;
    },
    release(): void {
      const next = waiting.shift();
      if (next) next();
      else active--;
    },
  };
}

export function createLatexService(opts: ServiceOptions): Server {
  const expected = digest(opts.token);
  const slots = limiter(opts.concurrency, opts.queue);
  const log = opts.log ?? (() => {});

  const authorised = (req: IncomingMessage): boolean => {
    const m = /^Bearer (\S+)$/.exec(req.headers.authorization ?? '');
    return m !== null && timingSafeEqual(digest(m[1] ?? ''), expected);
  };

  async function compile(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!authorised(req)) return send(res, 401, { error: 'unauthorised' });
    let body: Buffer;
    try {
      body = await readBody(req, opts.maxBytes);
    } catch (err) {
      if (err instanceof TooLarge) return send(res, 413, { error: `the source is over ${opts.maxBytes} bytes` }, { connection: 'close' });
      return send(res, 400, { error: 'the request body could not be read' });
    }
    let tex: string;
    try {
      tex = new TextDecoder('utf-8', { fatal: true }).decode(body);
    } catch {
      return send(res, 400, { error: 'the source is not valid UTF-8' });
    }
    if (tex.trim() === '') return send(res, 400, { error: 'the source is empty' });

    if (!(await slots.acquire())) return send(res, 503, { error: 'busy' }, { 'retry-after': '2' });
    let result: RunResult;
    try {
      result = await opts.compile(tex);
    } finally {
      slots.release();
    }
    log({ msg: 'compile', outcome: result.kind, bytes: body.length, ...(result.kind === 'ok' ? { ms: result.output.ms, pages: result.output.pages } : {}) });
    switch (result.kind) {
      case 'ok': {
        const { pdf, pages, pngs, ms } = result.output;
        return send(res, 200, { pdf: pdf.toString('base64'), pages, pngs: pngs.map((p) => p.toString('base64')), ms });
      }
      case 'compile-error':
        return send(res, 422, { error: 'compile failed', log: result.log });
      case 'too-many-pages':
        return send(res, 422, { error: `the document has ${result.pages} pages`, log: [] });
      case 'timeout':
        return send(res, 504, { error: 'the compile took too long' });
    }
  }

  return createServer({ requestTimeout: 60_000, headersTimeout: 10_000 }, (req, res) => {
    const path = (req.url ?? '').split('?')[0];
    if (req.method === 'GET' && path === '/health') return send(res, 200, { ok: true });
    if (req.method === 'POST' && path === '/compile') {
      compile(req, res).catch((err: unknown) => {
        log({ msg: 'compile crashed', err: err instanceof Error ? err.message : String(err) });
        if (!res.headersSent) send(res, 500, { error: 'internal error' });
      });
      return;
    }
    send(res, 404, { error: 'not found' });
  });
}
