import { loadLinkReaderServiceConfig } from '../config/linkReaderService';
import { createPageReader } from '../links/read';
import { createPageRenderer } from '../links/render';
import { createLinkService } from '../links/server';

/**
 * The link reader (docker/Dockerfile target `link-reader`, compose profile `links`, toreview
 * §144.3). Pages from the open web run here, in Chromium, so this process holds nothing worth
 * taking: no database, no storage, no model key. Its one secret is the bearer token.
 */

const config = loadLinkReaderServiceConfig();
const log = (event: Record<string, unknown>) => console.log(JSON.stringify({ time: new Date().toISOString(), service: 'link-reader', ...event }));

const renderer = config.CHROMIUM_PATH || config.noSandbox ? createPageRenderer({ ...(config.CHROMIUM_PATH ? { executablePath: config.CHROMIUM_PATH } : {}), noSandbox: config.noSandbox }) : undefined;
const read = createPageReader({ timeoutMs: config.LINK_READER_TIMEOUT_MS, maxBytes: config.LINK_READER_MAX_BYTES, ...(renderer ? { renderer } : {}) });

const server = createLinkService({ token: config.token, concurrency: config.LINK_READER_CONCURRENCY, queue: config.LINK_READER_QUEUE, read, log });

server.listen(config.LINK_READER_PORT, config.LINK_READER_HOST, () => log({ msg: 'listening', port: config.LINK_READER_PORT, browser: Boolean(renderer) }));

const stop = () => {
  server.close(() => {
    void Promise.resolve(renderer?.close()).finally(() => process.exit(0));
  });
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
