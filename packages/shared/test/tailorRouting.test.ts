import { describe, expect, it, vi } from 'vitest';

import type { GenerationInput } from '../src/models/generation';
import type { TailorRun } from '../src/models/tailor';
import { createMockRepos } from '../src/repos';
import { createHttpClient } from '../src/repos/http/client';
import {
  createHttpGenerationsRepo,
  servedOnServer,
  toTailoring,
} from '../src/repos/http/generationsRepo';
import { createMockStore } from '../src/repos/state';
import { generationInputSchema } from '../src/schemas/generation';

/** A tailored run goes to the server when it tailors a server resume (toreview §110.3). */

const SERVER_RESUME = '0b6a8e5e-4c1f-4f7a-9a51-2c3d4e5f6a7b';
const SERVER_JD = '7d1c2b3a-5e6f-4a8b-9c0d-1e2f3a4b5c6d';

const run: TailorRun = {
  sourceResumeId: SERVER_RESUME,
  baselineScore: 53,
  added: ['Terraform'],
  skipped: ['Redis'],
};
const tailored = (patch: Partial<GenerationInput> = {}): GenerationInput => ({
  kind: 'resume',
  jdId: SERVER_JD,
  baseResumeId: SERVER_RESUME,
  tailor: run,
  ...patch,
});

describe('servedOnServer', () => {
  it('serves a tailored run of a server resume, and keeps a mock resume’s on the mock', () => {
    expect(servedOnServer(tailored())).toBe(true);
    expect(servedOnServer(tailored({ baseResumeId: 'res_pd' }))).toBe(false);
    expect(servedOnServer(tailored({ jdId: 'jd_mock' }))).toBe(false);
  });
  it('a JD run that names a base resume without tailoring it stays on the mock', () => {
    expect(servedOnServer({ kind: 'resume', jdId: SERVER_JD, baseResumeId: SERVER_RESUME })).toBe(
      false,
    );
    expect(servedOnServer({ kind: 'resume', jdId: SERVER_JD })).toBe(true);
  });
});

describe('toTailoring', () => {
  it('sends the parts, the depth and the ticks — never the client’s baseline or skips', () => {
    expect(toTailoring({ ...run, fixes: ['summary'], experience: 'quick' })).toEqual({
      fixes: ['summary'],
      experience: 'quick',
      keywords: ['Terraform'],
    });
    // Mobile's runs leave the parts unset: all of them, every role.
    expect(toTailoring(run)).toEqual({
      fixes: ['headline', 'summary', 'skills', 'experience', 'projects', 'length'],
      experience: 'full',
      keywords: ['Terraform'],
    });
  });

  it('the request the repo posts is one the server accepts', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ id: 'x' }), { status: 400 }));
    const http = createHttpClient({ baseUrl: 'http://api.test', client: 'web', fetch });
    const repo = createHttpGenerationsRepo(
      http,
      createMockRepos(createMockStore()).generations,
      () => undefined,
    );
    await repo.start(tailored()).catch(() => undefined);
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.tailor).toBeUndefined();
    expect(generationInputSchema.parse(body)).toMatchObject({
      baseResumeId: SERVER_RESUME,
      tailoring: { keywords: ['Terraform'] },
    });
  });
});
