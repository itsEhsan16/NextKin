import { focusManager, MutationObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { createQueryClient, onConsentRequired } from '../src/queries';
import { createHttpClient } from '../src/repos/http/client';
import { createHttpAssistantRepo } from '../src/repos/http/assistantRepo';
import { ConsentRequiredError } from '../src/repos/state';

/** toreview §260: a dead reply is given up on; a refused rewrite is not quietly re-run. */

describe('an assistant reply that can no longer be followed', () => {
  it('is given up on when it is gone, instead of "Thinking…" for ever', async () => {
    focusManager.setFocused(true);
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'gone', details: null, request_id: 'r' } }), { status: 404 }));
    const repo = createHttpAssistantRepo(createHttpClient({ baseUrl: 'http://api.test', client: 'web', fetch, retryDelayMs: () => 0 }), { everyMs: 1 });
    let gaveUp = false;
    const stop = repo.subscribe('m1', () => undefined, () => (gaveUp = true));
    for (let i = 0; i < 200 && !gaveUp; i++) await new Promise((r) => setTimeout(r, 2));
    stop();
    expect(gaveUp).toBe(true);
  });
});

describe('a mutation refused for consent', () => {
  it('is re-run after consent, unless it opted out', async () => {
    const client = createQueryClient();
    const retries: (() => void)[] = [];
    const off = onConsentRequired((retry) => {
      if (retry) retries.push(retry);
    });
    let runs = 0;
    const refuse = async () => {
      runs++;
      throw new ConsentRequiredError();
    };
    for (const meta of [undefined, { consentRetry: false }]) {
      const observer = new MutationObserver(client, { mutationFn: refuse, ...(meta ? { meta } : {}) });
      await observer.mutate(undefined).catch(() => undefined);
    }
    expect(runs).toBe(2);
    retries.forEach((r) => r());
    await new Promise((r) => setTimeout(r, 5));
    expect(runs).toBe(3); // only the one that didn't opt out ran again
    off?.();
  });
});
