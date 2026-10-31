import { LinkError, parseLink, type LinkPolicy } from './address';
import { fetchPage } from './fetchPage';
import { isChallenge, isEnough, readHtml, type PageReading } from './reading';
import type { PageRenderer } from './render';
import { createRobotsCheck } from './robots';

/**
 * Reads one job link (owner, 2026-10-18; toreview §144.3). The rule that holds it together: **a
 * site that refuses is taken at its word.** A robots.txt that says no, a 401, 403, 429 or 503, or a
 * bot check ends the read with `refused`, and nothing here tries another way in. The browser is
 * only for a page the site served gladly that needs JavaScript to show its text.
 */

const HTML = /text\/html|application\/xhtml\+xml|text\/plain/;
const REFUSED = new Set([401, 403, 407, 429, 451, 503]);

export interface ReaderOptions {
  timeoutMs: number;
  maxBytes: number;
  renderer?: PageRenderer;
  policy?: LinkPolicy;
}

export function createPageReader(options: ReaderOptions) {
  const { timeoutMs, maxBytes, renderer, policy } = options;
  const net = { timeoutMs, ...(policy ? { policy } : {}) };
  const assertAllowed = createRobotsCheck(net);

  return async function readPage(raw: string): Promise<PageReading> {
    const url = parseLink(raw, policy);
    const page = await fetchPage(url, { ...net, maxBytes, beforeRequest: assertAllowed });
    if (REFUSED.has(page.status)) throw new LinkError('refused');
    if (page.status === 404 || page.status === 410) throw new LinkError('gone');
    if (page.status < 200 || page.status >= 300) throw new LinkError('unreachable');
    if (!HTML.test(page.contentType)) throw new LinkError('unsupported');
    const reading = readHtml(page.body.toString('utf8'), page.url.href);
    if (isChallenge(reading)) throw new LinkError('refused');
    if (isEnough(reading)) return reading;
    if (!renderer) throw new LinkError('empty');
    const rendered = await renderer.render(page.url.href, timeoutMs);
    if (isChallenge(rendered)) throw new LinkError('refused');
    if (!isEnough(rendered)) throw new LinkError('empty');
    return rendered;
  };
}

export type PageReaderFn = ReturnType<typeof createPageReader>;
