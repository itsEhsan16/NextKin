import { readFileSync } from 'node:fs';
import { z } from 'zod';

import { ConfigError } from './index';

/**
 * Configuration for the sealed LaTeX compile service and its relay (the `latex` compose profile,
 * toreview §111). These processes run in their own container with none of the app's settings, so
 * they get their own small schema instead of `loadConfig()`; it lives here because src/config is
 * the only place that reads process.env.
 *
 * The bearer token is read from a file (a compose secret, mounted read-only), never from an
 * environment variable, and the service refuses to start without it.
 */

const int = (min: number, max: number, fallback: number) => z.coerce.number().int().min(min).max(max).default(fallback);

const serviceSchema = z.object({
  LATEX_TOKEN_FILE: z.string().min(1),
  LATEX_HOST: z.string().min(1).default('0.0.0.0'),
  LATEX_PORT: int(1, 65535, 8790),
  // Compiles that run at once; more wait in a short queue, then get 503.
  LATEX_CONCURRENCY: int(1, 8, 2),
  LATEX_QUEUE: int(0, 64, 4),
  // Wall-clock limit for one request's tectonic + pdfinfo + pdftoppm, after which it is killed.
  LATEX_TIMEOUT_MS: int(1000, 120_000, 15_000),
  LATEX_MAX_BYTES: int(1024, 8 * 1024 * 1024, 1024 * 1024),
  LATEX_DPI: int(36, 300, 110),
  LATEX_MAX_PAGES: int(1, 50, 10),
  TECTONIC_BIN: z.string().min(1).default('tectonic'),
  PDFINFO_BIN: z.string().min(1).default('pdfinfo'),
  PDFTOPPM_BIN: z.string().min(1).default('pdftoppm'),
  // Passed through to Tectonic: the build-time cache (read-only at run time) and a font config
  // with no font directories, so nothing outside the bundle is ever loaded.
  TECTONIC_CACHE_DIR: z.string().min(1).optional(),
  FONTCONFIG_FILE: z.string().min(1).optional(),
});

export type LatexServiceConfig = z.infer<typeof serviceSchema> & { token: string };

function parse<T extends z.ZodType>(schema: T, env: Record<string, string | undefined>): z.infer<T> {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`));
  }
  return parsed.data;
}

/** Reads a bearer token from a file; refuses a missing, unreadable or short one. */
export function readTokenFile(path: string, name: string): string {
  let token: string;
  try {
    token = readFileSync(path, 'utf8').trim();
  } catch (err) {
    throw new ConfigError([`${name}: cannot read the token file (${(err as NodeJS.ErrnoException).code ?? 'error'})`]);
  }
  if (token.length < 32) throw new ConfigError([`${name}: the token must be at least 32 characters`]);
  return token;
}

export function loadLatexServiceConfig(env: Record<string, string | undefined> = process.env): LatexServiceConfig {
  const config = parse(serviceSchema, env);
  return { ...config, token: readTokenFile(config.LATEX_TOKEN_FILE, 'LATEX_TOKEN_FILE') };
}

const relaySchema = z.object({
  LATEX_RELAY_HOST: z.string().min(1).default('0.0.0.0'),
  LATEX_RELAY_PORT: int(1, 65535, 8790),
  LATEX_RELAY_TARGET_HOST: z.string().min(1).default('latex'),
  LATEX_RELAY_TARGET_PORT: int(1, 65535, 8790),
});

export type LatexRelayConfig = z.infer<typeof relaySchema>;

export function loadLatexRelayConfig(env: Record<string, string | undefined> = process.env): LatexRelayConfig {
  return parse(relaySchema, env);
}
