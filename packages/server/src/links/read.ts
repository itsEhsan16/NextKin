import { LinkError, parseLink, type LinkPolicy } from './address';
import { fetchPage } from './fetchPage';
import { isChallenge, isEnough, notOnePosting, readHtml, type PageReading } from './reading';
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

/** The reading, unless the page is a list of jobs or a posting that is gone (toreview §206). */
function onePosting(reading: PageReading): PageReading {
  const not = notOnePosting(reading);
  if (not) throw new LinkError(not);
  return reading;
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
    const context = { requested: url.href, now: new Date() };
    const reading = readHtml(page.body.toString('utf8'), page.url.href, context);
    if (isChallenge(reading)) throw new LinkError('refused');
    // A posting that says it was taken down has said all it will, however little text it holds.
    if (reading.pageKind === 'removed') throw new LinkError('removed');
    if (isEnough(reading)) return onePosting(reading);
    if (!renderer) throw new LinkError(notOnePosting(reading) ?? 'empty');
    // A thin page may be a shell that draws itself: its kind is judged once a browser has shown it.
    const rendered = await renderer.render(page.url.href, timeoutMs, context);
    if (isChallenge(rendered)) throw new LinkError('refused');
    const not = notOnePosting(rendered);
    if (not) throw new LinkError(not);
    if (!isEnough(rendered)) throw new LinkError('empty');
    return rendered;
  };
}

export type PageReaderFn = ReturnType<typeof createPageReader>;
