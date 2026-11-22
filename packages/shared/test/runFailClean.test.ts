import { focusManager } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMockRepos } from '../src/repos';
import { createHttpClient } from '../src/repos/http/client';
import { createHttpGenerationsRepo, isPermanentPollError } from '../src/repos/http/generationsRepo';
import { createMockStore, NotFoundError } from '../src/repos/state';
import { startErrorLine } from '../src/tailor/customize';
import type { Generation } from '../src/models/generation';
import type { WatchProblem } from '../src/repos/types';

/** The poller always stops, and a refused start says why (owner, 2026-11-22). */

const RUN = '7d1c2b3a-5e6f-4a8b-9c0d-1e2f3a4b5c6d';
const run = (status: Generation['status']) => ({ id: RUN, kind: 'resume', status, progress: status === 'ready' ? 1 : 0.5, startedAt: '2026-11-22T00:00:00Z', updatedAt: '2026-11-22T00:00:00Z', resumeId: 'r1' });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const envelope = (code: string, status: number) => json({ error: { code, message: code, details: null, request_id: 'r' } }, status);

function repoWith(fetch: (url: string) => Promise<Response>) {
  const http = createHttpClient({ baseUrl: 'http://api.test', client: 'web', fetch: (input) => fetch(String(input)), retryDelayMs: () => 0 });
  return createHttpGenerationsRepo(http, createMockRepos(createMockStore()).generations, () => undefined, { everyMs: 1 });
}

function watch(repo: ReturnType<typeof repoWith>) {
  const seen: Generation[] = [];
  const problems: WatchProblem[] = [];
  const stop = repo.subscribe(RUN, (g) => seen.push(g), (p) => problems.push(p));
  return { seen, problems, stop };
}

const until = async (check: () => boolean) => {
  for (let i = 0; i < 400 && !check(); i++) await new Promise((r) => setTimeout(r, 2));
};

afterEach(() => vi.restoreAllMocks());

describe('the progress poll', () => {
  it('stops and says so when the run is gone', async () => {
    focusManager.setFocused(true);
    const fetch = vi.fn(async () => envelope('NOT_FOUND', 404));
    const w = watch(repoWith(fetch));
    await until(() => w.problems.length > 0);
    const calls = fetch.mock.calls.length;
    await new Promise((r) => setTimeout(r, 30));
    expect(w.problems[0]).toMatchObject({ permanent: true });
    expect(fetch.mock.calls.length).toBe(calls); // no further polls
    w.stop();
  });

  it('stops on a payload this build cannot read', async () => {
    focusManager.setFocused(true);
    const w = watch(repoWith(async () => json({ id: RUN, status: 'mystery' })));
    await until(() => w.problems.length > 0);
    expect(w.problems[0]).toMatchObject({ permanent: true });
    w.stop();
  });

  it('a ready run is shown as ready even when its document cannot be copied in', async () => {
    focusManager.setFocused(true);
    const w = watch(repoWith(async (url) => (url.endsWith('/result') ? envelope('INTERNAL', 500) : json(run('ready')))));
    await until(() => w.seen.length > 0);
    expect(w.seen.at(-1)?.status).toBe('ready');
    expect(w.problems).toEqual([]);
    w.stop();
  });

  it('a dropped poll is retried, and the run still lands', async () => {
    focusManager.setFocused(true);
    let n = 0;
    const w = watch(repoWith(async () => (++n < 3 ? Promise.reject(new TypeError('offline')) : json(run('failed')))));
    await until(() => w.seen.length > 0);
    expect(w.seen.at(-1)?.status).toBe('failed');
    expect(w.problems).toEqual([]);
    w.stop();
  });

  it('only a gone, forbidden or unreadable run is permanent', () => {
    expect(isPermanentPollError(new NotFoundError('Generation', RUN))).toBe(true);
    expect(isPermanentPollError(new TypeError('x'))).toBe(false);
  });
});

describe('a start the server refused', () => {
  it('names the reason instead of "Try again" for every case', () => {
    expect(startErrorLine({ code: 'PLAN_LOCKED', message: 'You have used 3 of 3 tailored resumes this month.' })).toBe('You have used 3 of 3 tailored resumes this month.');
    expect(startErrorLine({ code: 'PLAN_LOCKED', message: '"Tailor" needs NextKin Pro' })).toMatch(/this month’s runs/);
    expect(startErrorLine({ code: 'UNAVAILABLE' })).toMatch(/busy/);
    expect(startErrorLine({ code: 'RATE_LIMITED' })).toMatch(/Wait a minute/);
    expect(startErrorLine({ code: 'NETWORK', message: 'NextKin took too long to answer. Try again.' })).toMatch(/Check Generations/);
    expect(startErrorLine({ code: 'NETWORK', message: 'Could not reach NextKin.' })).toMatch(/connection/);
    expect(startErrorLine(new Error('x'))).toBe('We couldn’t start tailoring. Try again.');
  });
});

describe('a start that got no answer', () => {
  it('pressing again with the same choices reuses the idempotency key', async () => {
    const keys: string[] = [];
    const http = createHttpClient({
      baseUrl: 'http://api.test',
      client: 'web',
      retryDelayMs: () => 0,
      fetch: async (_input, init) => {
        keys.push(String((init?.headers as Record<string, string>)['idempotency-key']));
        return keys.length <= 2 ? Promise.reject(new TypeError('offline')) : json(run('queued'), 201);
      },
    });
    const repo = createHttpGenerationsRepo(http, createMockRepos(createMockStore()).generations, () => undefined);
    const input = { kind: 'resume' as const };
    await expect(repo.start(input)).rejects.toMatchObject({ code: 'NETWORK' });
    await expect(repo.start(input)).resolves.toMatchObject({ id: RUN });
    expect(new Set(keys).size).toBe(1);
  });
});
