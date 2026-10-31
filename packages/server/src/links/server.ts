import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import { LinkError } from './address';
import type { PageReaderFn } from './read';

/**
 * The link reader's HTTP surface (toreview §144.3). It holds no secret of the app's and can reach
 * nothing of the app's: the worker sends it a URL and gets back text. Two routes:
 *   GET  /health  200 when the process is up
 *   POST /read    Authorization: Bearer <token>, body { url }
 *     200 { reading }      422 { reason }  the page could not be read, and why
 *     401 bad token        503 busy (Retry-After)
 */

export interface LinkServiceOptions {
  token: string;
  concurrency: number;
  queue: number;
  read: PageReaderFn;
  log?: (event: Record<string, unknown>) => void;
}

const MAX_REQUEST_BYTES = 8 * 1024;
const digest = (s: string) => createHash('sha256').update(s).digest();

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(json), 'cache-control': 'no-store', ...headers });
  res.end(json);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_REQUEST_BYTES) {
        req.destroy();
        reject(new Error('too large'));
      } else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function createLinkService(options: LinkServiceOptions): Server {
  const expected = digest(options.token);
  const log = options.log ?? (() => {});
  let active = 0;
  const waiting: (() => void)[] = [];

  const acquire = async (): Promise<boolean> => {
    if (active < options.concurrency) {
      active++;
      return true;
    }
    if (waiting.length >= options.queue) return false;
    await new Promise<void>((resolve) => waiting.push(resolve));
    return true;
  };
  const release = (): void => {
    const next = waiting.shift();
    if (next) next();
    else active--;
  };

  const authorised = (req: IncomingMessage): boolean => {
    const match = /^Bearer (\S+)$/.exec(req.headers.authorization ?? '');
    return match !== null && timingSafeEqual(digest(match[1] ?? ''), expected);
  };

  async function read(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!authorised(req)) return send(res, 401, { error: 'unauthorised' });
    let url: unknown;
    try {
      url = (JSON.parse(await readBody(req)) as { url?: unknown }).url;
    } catch {
      return send(res, 400, { error: 'the body must be JSON' });
    }
    if (typeof url !== 'string') return send(res, 400, { error: 'url is required' });
    if (!(await acquire())) return send(res, 503, { error: 'busy' }, { 'retry-after': '2' });
    const started = Date.now();
    try {
      const reading = await options.read(url);
      // The address alone: what a page says is the user's business, not a log's.
      log({ msg: 'read', outcome: 'ok', host: new URL(reading.url).hostname, structured: reading.structured, words: reading.words, ms: Date.now() - started });
      send(res, 200, { reading });
    } catch (error) {
      const reason = error instanceof LinkError ? error.reason : 'unreachable';
      log({ msg: 'read', outcome: reason, ms: Date.now() - started });
      send(res, 422, { reason });
    } finally {
      release();
    }
  }

  return createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true });
    if (req.method === 'POST' && req.url === '/read') {
      void read(req, res).catch(() => send(res, 500, { error: 'internal' }));
      return;
    }
    send(res, 404, { error: 'not found' });
  });
}
