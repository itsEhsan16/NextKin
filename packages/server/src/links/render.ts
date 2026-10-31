import { chromium, type Browser } from 'playwright-core';

import { LinkError, type LinkPolicy } from './address';
import { USER_AGENT } from './fetchPage';
import { startGuardProxy, type GuardProxy } from './proxy';
import { readRendered, type PageReading } from './reading';

/**
 * A page that needs a browser to show its content (toreview §144.3). Only a page the site served
 * gladly reaches here: a site that refused the first fetch is never retried through a browser, and
 * we never disguise what we are. Each read gets a fresh context with no storage, no downloads and
 * no service workers, and every request leaves through the guard proxy.
 */

const REFUSED = new Set([401, 403, 407, 429, 451, 503]);
const SKIPPED = new Set(['image', 'media', 'font']);
/** How long a page may take to show its text after it has loaded. */
const SETTLE_MS = 6000;
const SETTLED_CHARS = 1500;

export interface PageRenderer {
  render(url: string, timeoutMs: number): Promise<PageReading>;
  close(): Promise<void>;
}

export interface RendererOptions {
  executablePath?: string;
  /** In a container that has no sandbox to give; the container is the sandbox. */
  noSandbox?: boolean;
  policy?: LinkPolicy;
}

export function createPageRenderer(options: RendererOptions = {}): PageRenderer {
  let started: Promise<{ browser: Browser; proxy: GuardProxy }> | null = null;

  const start = async () => {
    const proxy = await startGuardProxy(options.policy);
    const browser = await chromium.launch({
      ...(options.executablePath ? { executablePath: options.executablePath } : {}),
      proxy: { server: `http://127.0.0.1:${proxy.port}`, bypass: '<-loopback>' },
      args: [...(options.noSandbox ? ['--no-sandbox'] : []), '--disable-quic', '--force-webrtc-ip-handling-policy=disable_non_proxied_udp', '--disable-extensions', '--disable-background-networking', '--disable-sync', '--disable-dev-shm-usage'],
    });
    browser.on('disconnected', () => {
      started = null;
      void proxy.close();
    });
    return { browser, proxy };
  };

  return {
    async render(url, timeoutMs) {
      started ??= start().catch((error: unknown) => {
        started = null;
        throw error;
      });
      const { browser } = await started;
      const context = await browser.newContext({ userAgent: USER_AGENT, acceptDownloads: false, serviceWorkers: 'block', javaScriptEnabled: true, locale: 'en-US' });
      try {
        const page = await context.newPage();
        // Pictures say nothing a job posting needs, and each is a request to someone's server.
        await page.route('**/*', (route) => (SKIPPED.has(route.request().resourceType()) ? route.abort() : route.continue()));
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
        const status = response?.status() ?? 0;
        if (REFUSED.has(status)) throw new LinkError('refused');
        if (status === 404 || status === 410) throw new LinkError('gone');
        if (status >= 400) throw new LinkError('unreachable');
        await page.waitForFunction((chars) => (document.body?.innerText.length ?? 0) >= chars, SETTLED_CHARS, { timeout: Math.min(SETTLE_MS, timeoutMs) }).catch(() => undefined);
        const seen = await page.evaluate(() => ({
          title: document.title,
          text: document.body?.innerText ?? '',
          jsonLd: [...document.querySelectorAll('script[type*="ld+json"]')].map((s) => s.textContent ?? ''),
        }));
        return readRendered({ url: page.url(), ...seen });
      } catch (error) {
        if (error instanceof LinkError) throw error;
        throw new LinkError(error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'unreachable');
      } finally {
        await context.close().catch(() => undefined);
      }
    },
    async close() {
      const running = await started?.catch(() => null);
      started = null;
      await running?.browser.close();
      await running?.proxy.close();
    },
  };
}
