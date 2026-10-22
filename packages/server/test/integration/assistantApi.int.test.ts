import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mobileLogin, registered, startHarness, type Harness } from './fixtures/authHarness';

/**
 * P11-09 through the shared client both apps run: the current chat, a streamed reply read as it
 * grows, a declined off-topic message, and the History (new chat, reopen). The API runs the
 * deterministic stand-in brain, as local and CI do without a key.
 */
let h: Harness;
beforeAll(async () => {
  h = await startHarness({});
});
afterAll(async () => {
  await h.close();
});

describe('the assistant over the apps’ HTTP repository (P11-09)', () => {
  it('chats, streams, declines and keeps its history', async () => {
    const { createRepos } = await import('@nextkin/shared/repos/create');
    const { createMockRepos } = await import('@nextkin/shared/repos');
    const { createMockStore } = await import('@nextkin/shared/repos/state');
    const { createHttpClient } = await import('@nextkin/shared/repos/http/client');

    const email = await registered(h);
    const tokens = await mobileLogin(h, email);
    let stored = { ...tokens, expiresIn: 3600 };
    const http = createHttpClient({
      baseUrl: 'http://localhost:3000',
      client: 'mobile',
      tokens: { get: async () => stored, set: async (next) => void (next && (stored = next)) },
      fetch: (input, init) => h.app.request(String(input), init) as Promise<Response>,
    });
    const { repos } = createRepos({ sources: { assistant: 'http' }, http }, createMockRepos(createMockStore()));

    const empty = await repos.assistant.getConversation();
    expect(empty.messages).toHaveLength(0);

    const { user, reply } = await repos.assistant.send({ text: 'How should I answer tell me about yourself in an interview?' });
    expect(user.role).toBe('user');
    expect(reply.status).toBe('streaming');
    const done = await new Promise<{ status: string; text: string }>((resolve) => {
      const stop = repos.assistant.subscribe(reply.id, (m) => {
        if (m.status !== 'streaming') {
          stop();
          resolve(m);
        }
      });
    });
    expect(done.status).toBe('complete');
    expect(done.text.length).toBeGreaterThan(20);

    const declined = await repos.assistant.send({ text: 'Tell me a joke.' });
    expect(declined.reply).toMatchObject({ status: 'complete', refusal: 'off_topic' });

    const first = await repos.assistant.getConversation();
    expect(first.messages).toHaveLength(4);
    const fresh = await repos.assistant.startNew();
    expect(fresh.messages).toHaveLength(0);
    const threads = await repos.assistant.listThreads();
    expect(threads.map((t) => t.id)).toEqual([first.id]);
    expect((await repos.assistant.openThread(first.id)).messages).toHaveLength(4);
    expect((await repos.assistant.clear()).messages).toHaveLength(0);
  }, 60_000);
});
