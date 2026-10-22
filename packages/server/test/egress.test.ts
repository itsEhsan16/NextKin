import { afterEach, describe, expect, it, vi } from 'vitest';

import { createClaudeDirect } from '../src/ai/providers/claudeDirect';
import { EgressBlockedError, egressHostsFor, guardedFetch, setEgressAllowlist } from '../src/net/egress';

/** P11-06: the server reaches only configured hosts; no user-supplied URL is ever fetched. */

afterEach(() => setEgressAllowlist([]));

describe('the egress allowlist', () => {
  it('refuses an unlisted host before anything leaves the process, and lets a listed one through', async () => {
    const base = vi.fn(async () => new Response('ok'));
    setEgressAllowlist(['api.anthropic.com'], base as unknown as typeof fetch);
    await expect(guardedFetch('https://evil.example/steal')).rejects.toBeInstanceOf(EgressBlockedError);
    await expect(guardedFetch(new URL('https://169.254.169.254/latest/meta-data'))).rejects.toMatchObject({ host: '169.254.169.254' });
    expect(base).not.toHaveBeenCalled();
    await guardedFetch('https://API.anthropic.com/v1/messages', { method: 'POST' });
    expect(base).toHaveBeenCalledTimes(1);
  });

  it('lists only what the configured adapters need', () => {
    const local = { LLM_ROUTE: 'recorded', JOBS_ADAPTER: 'fixture' } as const;
    expect(egressHostsFor(local)).toEqual([]);
    expect(egressHostsFor({ ...local, LLM_ROUTE: 'claudeDirect' })).toEqual(['api.anthropic.com']);
    expect(egressHostsFor({ ...local, LLM_ROUTE: 'openrouter' })).toEqual(['openrouter.ai']);
    expect(egressHostsFor({ ...local, JOBS_ADAPTER: 'providers' })).toEqual(['api.adzuna.com', 'jsearch.p.rapidapi.com']);
    expect(egressHostsFor({ ...local, FEDERATION_GOOGLE_ISSUER: 'http://127.0.0.1:8090/google' })).toEqual(['127.0.0.1']);
  });

  it('the Claude SDK goes through it: with the host off the list, a call is refused', async () => {
    const base = vi.fn(async () => new Response('{}'));
    setEgressAllowlist([], base as unknown as typeof fetch);
    const provider = createClaudeDirect('sk-ant-test-not-a-real-key');
    await expect(provider.messages({ stage: 'hello', system: [], messages: [{ role: 'user', content: 'hi' }], maxTokens: 10 } as never)).rejects.toThrow();
    expect(base).not.toHaveBeenCalled();
  });
});
