import { readFile } from 'node:fs/promises';
import { z } from 'zod';

import type { Config } from '../../config';
import { guardedFetch } from '../../net/egress';
import type { CompileResult } from './types';

/**
 * The worker's client for the sealed LaTeX compile service (toreview §111): POST the .tex source
 * to `${LATEX_COMPILER_URL}/compile` with the bearer token, through the egress guard, and decode
 * the base64 PDF and PNGs into bytes. Every failure is a LatexCompileError naming its kind, so the
 * caller can tell a source the template got wrong (`compile`) from a service that is down.
 */

export type LatexCompileFailure =
  /** 422: Tectonic refused the source; `log` holds its last lines (no paths). */
  | 'compile'
  /** 504 from the service, or no answer within the client's own limit. */
  | 'timeout'
  /** 503: both compile slots and the queue were full. Retry later. */
  | 'busy'
  /** 400/401/413: the request itself was wrong (bad token, too large, not UTF-8). */
  | 'rejected'
  /** Unreachable, a 5xx, or an answer that is not the documented shape. */
  | 'unavailable';

export class LatexCompileError extends Error {
  constructor(
    readonly kind: LatexCompileFailure,
    message: string,
    readonly log: string[] = [],
    readonly status?: number,
  ) {
    super(message);
    this.name = 'LatexCompileError';
  }
}

export interface LatexCompiler {
  compile(tex: string): Promise<CompileResult>;
}

export type LatexCompilerConfig = Pick<Config, 'LATEX_COMPILER_URL'> & Partial<Pick<Config, 'LATEX_COMPILER_TOKEN' | 'LATEX_COMPILER_TOKEN_FILE'>>;

export interface LatexCompilerOptions {
  /** Defaults to guardedFetch (the egress allowlist). */
  fetch?: typeof fetch;
  /** The client's own wall-clock limit, above the service's 15 s compile limit plus queueing. */
  timeoutMs?: number;
}

const base64 = z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/);
const answer = z.object({ pdf: base64.min(1), pages: z.number().int().min(1), pngs: z.array(base64.min(1)), ms: z.number().min(0) });
const failure = z.object({ error: z.string().optional(), log: z.array(z.string()).optional() });

const bytes = (b64: string): Uint8Array => new Uint8Array(Buffer.from(b64, 'base64'));

export function createLatexCompiler(config: LatexCompilerConfig, options: LatexCompilerOptions = {}): LatexCompiler {
  const doFetch = options.fetch ?? guardedFetch;
  const timeoutMs = options.timeoutMs ?? 25_000;
  const endpoint = new URL('/compile', config.LATEX_COMPILER_URL).href;
  let token: Promise<string> | null = null;

  const tokenOf = (): Promise<string> => {
    if (config.LATEX_COMPILER_TOKEN) return Promise.resolve(config.LATEX_COMPILER_TOKEN);
    const file = config.LATEX_COMPILER_TOKEN_FILE;
    if (!file) return Promise.reject(new LatexCompileError('unavailable', 'no LaTeX compiler token: set LATEX_COMPILER_TOKEN_FILE'));
    token ??= readFile(file, 'utf8').then(
      (t) => t.trim(),
      (err: NodeJS.ErrnoException) => {
        token = null;
        throw new LatexCompileError('unavailable', `cannot read LATEX_COMPILER_TOKEN_FILE (${err.code ?? 'error'})`);
      },
    );
    return token;
  };

  return {
    async compile(tex) {
      const bearer = await tokenOf();
      let res: Response;
      try {
        res = await doFetch(endpoint, {
          method: 'POST',
          headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/x-tex; charset=utf-8' },
          body: tex,
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        const name = err instanceof Error ? err.name : '';
        if (name === 'TimeoutError' || name === 'AbortError') throw new LatexCompileError('timeout', `no answer from the LaTeX compiler within ${timeoutMs} ms`);
        throw new LatexCompileError('unavailable', `the LaTeX compiler is unreachable: ${err instanceof Error ? err.message : String(err)}`);
      }
      const body: unknown = await res.json().catch(() => null);
      if (res.ok) {
        const parsed = answer.safeParse(body);
        if (!parsed.success) throw new LatexCompileError('unavailable', 'the LaTeX compiler answered in an unexpected shape', [], res.status);
        const { pdf, pages, pngs, ms } = parsed.data;
        return { pdf: bytes(pdf), pages, pngs: pngs.map(bytes), ms };
      }
      const detail = failure.safeParse(body);
      const message = detail.success && detail.data.error ? detail.data.error : `HTTP ${res.status}`;
      const log = detail.success ? (detail.data.log ?? []) : [];
      if (res.status === 422) throw new LatexCompileError('compile', message, log, res.status);
      if (res.status === 504) throw new LatexCompileError('timeout', message, [], res.status);
      if (res.status === 503) throw new LatexCompileError('busy', message, [], res.status);
      if (res.status >= 400 && res.status < 500) throw new LatexCompileError('rejected', message, [], res.status);
      throw new LatexCompileError('unavailable', message, [], res.status);
    },
  };
}
