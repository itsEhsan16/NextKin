import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib';

import { LinkError, parseLink, PUBLIC_WEB, type LinkPolicy } from './address';

/**
 * One page, fetched the honest way (toreview §144.3). We say who we are in the user agent, follow
 * a few redirects, and stop at a cap. The address is checked as the socket is about to connect, on
 * every hop, so a name that resolves to a private address (or starts to, between two lookups) never
 * gets a connection.
 */

/** Who we say we are, in every request this service makes. */
export const READER_AGENT = 'NextKinReader';
export const USER_AGENT = `Mozilla/5.0 (compatible; ${READER_AGENT}/1.0; +https://nextkin.ai/reader)`;

const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;

export interface FetchOptions {
  timeoutMs: number;
  maxBytes: number;
  /** Tests point this at a local server; everywhere else it is `PUBLIC_WEB`. */
  policy?: LinkPolicy;
  /** Called for every URL before it is requested, the first and each redirect. */
  beforeRequest?: (url: URL) => Promise<void>;
  accept?: string;
}

export interface FetchedPage {
  status: number;
  url: URL;
  contentType: string;
  body: Buffer;
}

type LookupOptions = { all?: boolean };
type LookupCallback = (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/** `lookup` for a socket: every address DNS returns must pass, or nothing connects. */
export function guardedLookup(allow: (ip: string) => boolean) {
  return (hostname: string, options: LookupOptions, callback: LookupCallback): void => {
    dnsLookup(hostname, { all: true }, (error, addresses) => {
      if (error) return callback(error, '', 0);
      if (addresses.length === 0 || addresses.some((a) => !allow(a.address))) return callback(new LinkError('private'), '', 0);
      if (options.all) return callback(null, addresses);
      const first = addresses[0]!;
      callback(null, first.address, first.family);
    });
  };
}

function decode(body: Buffer, encoding: string | undefined, maxBytes: number): Buffer {
  const limit = { maxOutputLength: maxBytes * 4 };
  try {
    if (encoding === 'gzip' || encoding === 'x-gzip') return gunzipSync(body, limit);
    if (encoding === 'deflate') return inflateSync(body, limit);
    if (encoding === 'br') return brotliDecompressSync(body, limit);
    return body;
  } catch (error) {
    throw new LinkError((error as NodeJS.ErrnoException).code === 'ERR_BUFFER_TOO_LARGE' ? 'too_large' : 'unreachable');
  }
}

function once(url: URL, options: FetchOptions): Promise<{ response: IncomingMessage; body: Buffer }> {
  const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const req = send(
      url,
      {
        method: 'GET',
        agent: false,
        lookup: guardedLookup((options.policy ?? PUBLIC_WEB).allowAddress) as never,
        timeout: options.timeoutMs,
        headers: {
          'user-agent': USER_AGENT,
          accept: options.accept ?? 'text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8,*/*;q=0.1',
          'accept-encoding': 'gzip, deflate, br',
          'accept-language': 'en',
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > options.maxBytes) {
            req.destroy(new LinkError('too_large'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => resolve({ response, body: Buffer.concat(chunks) }));
        response.on('error', reject);
      },
    );
    req.setTimeout(options.timeoutMs, () => req.destroy(new LinkError('timeout')));
    req.on('error', reject);
    req.end();
  });
}

const toLinkError = (error: unknown): LinkError => (error instanceof LinkError ? error : new LinkError('unreachable', error instanceof Error ? error.message : 'unreachable'));

export async function fetchPage(start: URL, options: FetchOptions): Promise<FetchedPage> {
  const deadline = Date.now() + options.timeoutMs;
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await options.beforeRequest?.(url);
    const left = deadline - Date.now();
    if (left <= 0) throw new LinkError('timeout');
    const { response, body } = await once(url, { ...options, timeoutMs: left }).catch((error: unknown) => {
      throw toLinkError(error);
    });
    const status = response.statusCode ?? 0;
    const location = response.headers.location;
    if (REDIRECTS.has(status) && location) {
      url = parseLink(new URL(location, url).href, options.policy);
      continue;
    }
    const encoding = response.headers['content-encoding']?.toLowerCase();
    return { status, url, contentType: (response.headers['content-type'] ?? '').toLowerCase(), body: decode(body, encoding, options.maxBytes) };
  }
  throw new LinkError('unreachable', 'too many redirects');
}
