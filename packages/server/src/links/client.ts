import { readFile } from 'node:fs/promises';
import { z } from 'zod';

import type { Config } from '../config';
import { guardedFetch } from '../net/egress';
import { LinkError, type LinkFailure } from './address';
import type { PageReading } from './reading';

/** A reading as the worker receives it. A reader one release behind does not name the page's kind. */
export type LinkReading = Omit<PageReading, 'pageKind' | 'signals'> & Partial<Pick<PageReading, 'pageKind' | 'signals'>>;

/**
 * The worker's client for the link reader (toreview §144.3). The worker never touches a URL a user
 * gives: it asks the service, through the egress guard, and gets back text. A site's answer is a
 * `LinkError`, and final. A service that is down or busy is `LinkReaderUnavailableError`, and the
 * job comes back and tries again.
 */

export class LinkReaderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LinkReaderUnavailableError';
  }
}

export interface LinkReader {
  read(url: string): Promise<LinkReading>;
}

export type LinkReaderConfig = Pick<Config, 'LINK_READER_URL'> & Partial<Pick<Config, 'LINK_READER_TOKEN' | 'LINK_READER_TOKEN_FILE'>>;

const reading = z.object({
  url: z.string(),
  structured: z.boolean(),
  title: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  closesAt: z.string().optional(),
  text: z.string(),
  words: z.number(),
  // Absent from an older reader; the model's reading then judges the page on its own.
  pageKind: z.enum(['job', 'closed_job', 'listing', 'removed', 'unknown']).optional(),
  closedNote: z.string().optional(),
  signals: z
    .object({ postings: z.number(), listType: z.boolean(), jobLinks: z.number(), proseWords: z.number(), closedWording: z.string().optional(), redirected: z.boolean() })
    .optional(),
});
const answer = z.object({ reading });
const refusal = z.object({ reason: z.string() });

export function createLinkReader(config: LinkReaderConfig, options: { fetch?: typeof fetch; timeoutMs?: number } = {}): LinkReader {
  const doFetch = options.fetch ?? guardedFetch;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const endpoint = new URL('/read', config.LINK_READER_URL).href;
  let token: Promise<string> | null = null;

  const tokenOf = (): Promise<string> => {
    if (config.LINK_READER_TOKEN) return Promise.resolve(config.LINK_READER_TOKEN);
    if (!config.LINK_READER_TOKEN_FILE) return Promise.reject(new LinkReaderUnavailableError('no link reader token'));
    token ??= readFile(config.LINK_READER_TOKEN_FILE, 'utf8').then((text) => text.trim());
    return token;
  };

  return {
    async read(url) {
      let response: Response;
      try {
        response = await doFetch(endpoint, {
          method: 'POST',
          headers: { authorization: `Bearer ${await tokenOf()}`, 'content-type': 'application/json' },
          body: JSON.stringify({ url }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        throw new LinkReaderUnavailableError(error instanceof Error ? error.message : 'unreachable');
      }
      if (response.status === 200) return answer.parse(await response.json()).reading;
      if (response.status === 422) throw new LinkError(refusal.parse(await response.json()).reason as LinkFailure);
      throw new LinkReaderUnavailableError(`the link reader answered ${response.status}`);
    },
  };
}
