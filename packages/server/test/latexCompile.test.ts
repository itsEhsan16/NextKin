import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLatexCompiler, LatexCompileError } from '../src/export/latex/compile';
import { cleanLog, tectonicArgs, type RunResult } from '../src/export/latex/service/run';
import { createLatexService } from '../src/export/latex/service/server';
import { warmupSources } from '../src/export/latex/warmupSources';
import { lintTex } from '../src/export/latex/texLint';
import { setEgressAllowlist } from '../src/net/egress';

/** toreview §111: the worker's compile client and the sealed service's HTTP surface. */

const TOKEN = 'a'.repeat(64);
const URL_ = 'http://127.0.0.1:8790';
const b64 = (s: string) => Buffer.from(s).toString('base64');
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => setEgressAllowlist([]));

describe('the compile client', () => {
  it('posts the source with the bearer token through the egress guard, and decodes base64 into bytes', async () => {
    const base = vi.fn(async () => json(200, { pdf: b64('%PDF-1.7'), pages: 2, pngs: [b64('png1'), b64('png2')], ms: 812 }));
    setEgressAllowlist(['127.0.0.1'], base as unknown as typeof fetch);
    const result = await createLatexCompiler({ LATEX_COMPILER_URL: URL_, LATEX_COMPILER_TOKEN: TOKEN }).compile('\\documentclass{article}');
    expect(result.pdf).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(result.pdf).toString()).toBe('%PDF-1.7');
    expect(result.pngs.map((p) => Buffer.from(p).toString())).toEqual(['png1', 'png2']);
    expect(result).toMatchObject({ pages: 2, ms: 812 });
    const [url, init] = base.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${URL_}/compile`);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${TOKEN}`);
    expect(init.body).toBe('\\documentclass{article}');
  });

  it('is refused by the egress guard when the host is not on the allowlist', async () => {
    const base = vi.fn();
    setEgressAllowlist([], base as unknown as typeof fetch);
    await expect(createLatexCompiler({ LATEX_COMPILER_URL: URL_, LATEX_COMPILER_TOKEN: TOKEN }).compile('x')).rejects.toBeInstanceOf(LatexCompileError);
    expect(base).not.toHaveBeenCalled();
  });

  it('gives up after its own timeout', async () => {
    const hang: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)));
    const compiler = createLatexCompiler({ LATEX_COMPILER_URL: URL_, LATEX_COMPILER_TOKEN: TOKEN }, { fetch: hang, timeoutMs: 30 });
    await expect(compiler.compile('x')).rejects.toMatchObject({ kind: 'timeout' });
  });

  it.each([
    [422, { error: 'compile failed', log: ['! Undefined control sequence.'] }, 'compile'],
    [504, { error: 'the compile took too long' }, 'timeout'],
    [503, { error: 'busy' }, 'busy'],
    [401, { error: 'unauthorised' }, 'rejected'],
    [500, { error: 'internal error' }, 'unavailable'],
    [200, { pdf: 'not base64!', pages: 1, pngs: [], ms: 1 }, 'unavailable'],
  ] as const)('maps HTTP %i to a %s failure', async (status, body, kind) => {
    const compiler = createLatexCompiler({ LATEX_COMPILER_URL: URL_, LATEX_COMPILER_TOKEN: TOKEN }, { fetch: async () => json(status, body) });
    const err = await compiler.compile('x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LatexCompileError);
    expect(err).toMatchObject({ kind });
    if (status === 422) expect((err as LatexCompileError).log).toEqual(['! Undefined control sequence.']);
  });

  it('needs a token', async () => {
    await expect(createLatexCompiler({ LATEX_COMPILER_URL: URL_ }, { fetch: vi.fn() }).compile('x')).rejects.toMatchObject({ kind: 'unavailable' });
  });
});

/** The service with a stubbed compile, on a real port, called by the real client. */
async function serve(compile: (tex: string) => Promise<RunResult>, extra: { concurrency?: number; queue?: number } = {}) {
  const server = createLatexService({ token: TOKEN, maxBytes: 1024, concurrency: extra.concurrency ?? 2, queue: extra.queue ?? 0, compile });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { url, close: () => new Promise<void>((r) => server.close(() => r())) };
}

const ok: RunResult = { kind: 'ok', output: { pdf: Buffer.from('%PDF'), pages: 1, pngs: [Buffer.from('png')], ms: 5 } };

describe('the compile service', () => {
  it('answers health, and round-trips a compile to the client', async () => {
    const svc = await serve(async () => ok);
    try {
      expect((await fetch(`${svc.url}/health`)).status).toBe(200);
      const result = await createLatexCompiler({ LATEX_COMPILER_URL: svc.url, LATEX_COMPILER_TOKEN: TOKEN }, { fetch }).compile('\\x');
      expect(Buffer.from(result.pdf).toString()).toBe('%PDF');
      expect(result.pages).toBe(1);
    } finally {
      await svc.close();
    }
  });

  it('refuses a bad token, a body over the limit, invalid UTF-8 and an empty body', async () => {
    const compile = vi.fn(async () => ok);
    const svc = await serve(compile);
    const post = (body: BodyInit, token = TOKEN) => fetch(`${svc.url}/compile`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body });
    try {
      expect((await post('x', 'b'.repeat(64))).status).toBe(401);
      expect((await fetch(`${svc.url}/compile`, { method: 'POST', body: 'x' })).status).toBe(401);
      expect((await post('x'.repeat(2048))).status).toBe(413);
      expect((await post(new Uint8Array([0xff, 0xfe, 0x00]))).status).toBe(400);
      expect((await post('   ')).status).toBe(400);
      expect(compile).not.toHaveBeenCalled();
    } finally {
      await svc.close();
    }
  });

  it('maps compile failures to 422 with the log, a timeout to 504, and a full house to 503', async () => {
    let release: () => void = () => {};
    const results: (() => Promise<RunResult>)[] = [
      async () => ({ kind: 'compile-error', log: ['! Missing $ inserted.'] }),
      async () => ({ kind: 'timeout' }),
      () => new Promise((r) => (release = () => r(ok))),
    ];
    const svc = await serve(() => (results.shift() ?? (async () => ok))(), { concurrency: 1, queue: 0 });
    const post = () => fetch(`${svc.url}/compile`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, body: '\\x' });
    try {
      const failed = await post();
      expect(failed.status).toBe(422);
      expect(await failed.json()).toEqual({ error: 'compile failed', log: ['! Missing $ inserted.'] });
      expect((await post()).status).toBe(504);
      const slow = post();
      await new Promise((r) => setTimeout(r, 50));
      expect((await post()).status).toBe(503);
      release();
      expect((await slow).status).toBe(200);
    } finally {
      await svc.close();
    }
  });
});

describe('the compile job', () => {
  it('runs Tectonic 0.17 untrusted and cache-only, hiding the token file', () => {
    expect(tectonicArgs(['/run/secrets/latex_token'])).toEqual(['-X', 'compile', 'main.tex', '--untrusted', '--only-cached', '--hide', '/run/secrets/latex_token']);
  });

  it('keeps the last log lines without paths or font-config noise', () => {
    const log = 'note: Running TeX ...\nFontconfig error: x\n/tmp/tex-abc/main.tex:3: Undefined control sequence\nerror: in /opt/tectonic/cache/files/x.sty here\n';
    expect(cleanLog(log, '/tmp/tex-abc')).toEqual(['./main.tex:3: Undefined control sequence', 'error: in <path> here']);
  });

  it('warms the cache with every template’s own output, every density × paper, all lint-clean', () => {
    const sources = warmupSources();
    const names = (prefix: string) => ['letter-0', 'letter-1', 'letter-2', 'a4-0', 'a4-1', 'a4-2'].map((n) => `warmup-${prefix}${n}.tex`);
    expect(sources.map((s) => s.name)).toEqual([...names(''), ...names('modern-'), ...names('elegant-')]);
    for (const s of sources) {
      // The bold-italic probe line is the one addition; without it each source is exactly texOf.
      const plain = s.tex.replace('{\\bfseries\\itshape Bold italic.}\n', '');
      expect(lintTex(plain)).toMatchObject({ ok: true });
    }
  });
});
