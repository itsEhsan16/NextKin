import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { renderTemplateOf } from '../../src/services/renders';
import { mobileLogin, registered, startHarness, type Harness } from './fixtures/authHarness';

/**
 * toreview §124: the resume editor's document API through the shared HTTP repository. A blank
 * resume opens with the account's header, saves whole, reads back after a reload, keeps one
 * version per sitting, refuses a stale save, follows its template into the render queue, and
 * cannot be exported while it is empty.
 */
let h: Harness;

beforeAll(async () => {
  h = await startHarness({ files: true });
});
afterAll(async () => {
  await h.close();
});

describe('the resume editor document (toreview §124)', () => {
  it('opens, saves, reloads, coalesces a sitting, refuses a stale save and gates export', async () => {
    const { createRepos } = await import('@nextkin/shared/repos/create');
    const { createMockRepos, ExportBlockedError, ApiError } = await import('@nextkin/shared/repos');
    const { createMockStore } = await import('@nextkin/shared/repos/state');
    const { adoptDocument } = await import('@nextkin/shared/repos/adopt');
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
    const store = createMockStore();
    const { repos } = createRepos({ sources: { jd: 'http', generations: 'http', resumes: 'http' }, http, uploader: async () => {}, adopt: (doc) => adoptDocument(store, doc) }, createMockRepos(store));

    const created = await repos.resumes.create({ title: 'Untitled resume', docType: 'resume' });
    expect(created.draft).toBe(true);
    await expect(repos.resumes.export(created.id, 'pdf')).rejects.toSatisfy((e: unknown) => e instanceof ExportBlockedError && e.reason === 'incomplete');

    const opened = await repos.resumes.getDocument(created.id);
    expect(opened.header.items.some((i) => i.text === email)).toBe(true);
    expect(opened.template).toBe('jake');

    const { revision } = opened;
    const { header, summary, skills, experience, projects, education, certifications, custom, order, headings, template } = opened;
    const write = { header, summary, skills, experience, projects, education, certifications, custom, order, headings, template };
    const filled = {
      ...write,
      header: { ...write.header, name: 'Jordan Avery', headline: 'Backend Engineer' },
      summary: 'Builds payment systems in Go.',
      experience: [{ id: 'n-1', company: 'Lumen Pay', title: 'Engineer', location: 'Remote', start: '2021-03', end: null, bullets: [{ id: 'n-2', text: 'Cut settlement time from 3 days to 4 hours.' }], groups: [] }],
      custom: [{ id: 'awards', heading: 'Awards', entries: [], lines: [{ id: 'n-3', text: 'Hackathon winner, 2020' }] }],
      order: [...write.order, 'x:awards' as const],
      template: 'modern' as const,
    };
    const first = await repos.resumes.saveDocument(created.id, filled, revision);
    expect(first.experience[0]?.company).toBe('Lumen Pay');
    expect(first.revision).not.toBe(revision);

    // A second save in the same sitting replaces the first, at the same version number.
    const second = await repos.resumes.saveDocument(created.id, { ...filled, summary: 'Builds payment systems in Go and Postgres.' }, first.revision);
    const versions = await repos.resumes.getVersions(created.id);
    expect(versions.map((v) => v.version)).toEqual([2, 1]);
    expect(versions[0]?.id).toBe(second.versionId);

    // Reload: everything the editor saved is there, the custom section and the template included.
    const reloaded = await repos.resumes.getDocument(created.id);
    expect(reloaded.summary).toBe('Builds payment systems in Go and Postgres.');
    expect(reloaded.custom[0]?.lines[0]?.text).toBe('Hackathon winner, 2020');
    expect(reloaded.order.at(-1)).toBe('x:awards');
    expect(reloaded.template).toBe('modern');
    const card = await repos.resumes.get(created.id);
    expect(card.draft).toBeUndefined();

    // A save from the older revision is refused, never merged over the newer one.
    await expect(repos.resumes.saveDocument(created.id, filled, first.revision)).rejects.toSatisfy((e: unknown) => e instanceof ApiError && e.code === 'PRECONDITION_FAILED');

    // The version is queued for typesetting in its own template.
    const render = await h.db.withSystem('test: the render queued', (tx) => tx.selectFrom('resume_renders').select(['template_slug', 'template_rev']).where('resume_version_id', '=', second.versionId).executeTakeFirst());
    expect(render).toEqual({ template_slug: 'modern', template_rev: renderTemplateOf({ template: 'modern' }).rev });

    // The export gate moves on to the next check (the unverified email), past "incomplete".
    await expect(repos.resumes.export(created.id, 'pdf')).rejects.toSatisfy((e: unknown) => e instanceof ExportBlockedError && e.reason !== 'incomplete');

    // And it can be deleted, renders and all.
    await repos.resumes.remove(created.id);
    await expect(repos.resumes.get(created.id)).rejects.toThrow(/does not exist/);
  });
});
