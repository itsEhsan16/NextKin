import { z } from 'zod';

import { ConfigError } from './index';
import { readTokenFile } from './latexService';

/**
 * Configuration for the link reader service (`pnpm link-reader`, compose profile `links`, toreview
 * §144.3). It runs apart from the app with none of the app's settings or secrets, so it gets its
 * own small schema; it lives here because src/config is the only place that reads process.env.
 */

const int = (min: number, max: number, fallback: number) => z.coerce.number().int().min(min).max(max).default(fallback);

const schema = z.object({
  LINK_READER_TOKEN_FILE: z.string().min(1),
  LINK_READER_HOST: z.string().min(1).default('127.0.0.1'),
  LINK_READER_PORT: int(1, 65535, 8791),
  // Reads that run at once; more wait in a short queue, then get 503.
  LINK_READER_CONCURRENCY: int(1, 8, 2),
  LINK_READER_QUEUE: int(0, 64, 8),
  LINK_READER_TIMEOUT_MS: int(1000, 60_000, 20_000),
  LINK_READER_MAX_BYTES: int(1024, 16 * 1024 * 1024, 4 * 1024 * 1024),
  // Unset: the first fetch only, for a page that needs no browser. Local: ms-playwright's Chromium.
  CHROMIUM_PATH: z.string().min(1).optional(),
  // The image sets this: a container with no capabilities has no sandbox to give Chromium.
  LINK_READER_NO_SANDBOX: z.enum(['true', 'false']).default('false'),
});

export type LinkReaderServiceConfig = z.infer<typeof schema> & { token: string; noSandbox: boolean };

export function loadLinkReaderServiceConfig(env: Record<string, string | undefined> = process.env): LinkReaderServiceConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) throw new ConfigError(parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`));
  return { ...parsed.data, token: readTokenFile(parsed.data.LINK_READER_TOKEN_FILE, 'LINK_READER_TOKEN_FILE'), noSandbox: parsed.data.LINK_READER_NO_SANDBOX === 'true' };
}
