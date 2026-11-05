import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useMockModeStore } from '../src/mock/mode';
import {
  EvalRequiredError,
  NotCertifiedError,
  RubricNotReadyError,
  SourceRequiredError,
  SourceUrlError,
} from '../src/models/adminContent';
import { resetAdminMocks } from '../src/repos/adminMockReset';
import { createMockAdminContentRepo } from '../src/repos/adminContentRepo';

/** The admin Content area's rules on the mock (Figma 406:662–410:1771). Synthetic data only. */

const repo = createMockAdminContentRepo();

beforeEach(() => {
  // The mock's simulated latency, run fast.
  vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 50 });
  useMockModeStore.setState({ mode: 'normal' });
  resetAdminMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('prompts', () => {
  it('lists the board’s nine stages, three with drafts and one failing its eval', async () => {
    const { stages } = await repo.listPrompts();
    expect(stages.map((s) => s.name)).toHaveLength(9);
    expect(stages.filter((s) => s.draft)).toHaveLength(3);
    expect(stages.filter((s) => s.lastEval && !s.lastEval.passed).map((s) => s.name)).toEqual([
      'assistant.chat',
    ]);
  });

  it('publishes a draft only after a passing eval, and an edit needs a fresh one', async () => {
    await expect(repo.publishPrompt('cover.write', 8)).rejects.toBeInstanceOf(EvalRequiredError);

    const result = await repo.evaluatePrompt('cover.write', 8);
    expect(result.passed).toBe(true);
    await repo.savePromptDraft('cover.write', { tab: 'system', text: 'edited' });
    await expect(repo.publishPrompt('cover.write', 8)).rejects.toBeInstanceOf(EvalRequiredError);

    await repo.evaluatePrompt('cover.write', 8);
    const published = await repo.publishPrompt('cover.write', 8);
    expect(published.activeVersion).toBe(8);
    expect(published.draft).toBeNull();
    expect(
      (await repo.listPrompts()).stages.find((s) => s.name === 'cover.write')?.activeVersion,
    ).toBe(8);
  }, 20_000);

  it('rolls back to an earlier version at once', async () => {
    const detail = await repo.rollbackPrompt('tailor.rewrite', 13);
    expect(detail.activeVersion).toBe(13);
    expect(detail.versions.filter((v) => v.status === 'active').map((v) => v.version)).toEqual([
      13,
    ]);
  });

  it('shows the version a rollback reaches, with its own text and no other version’s eval', async () => {
    await repo.savePromptDraft('tailor.rewrite', { tab: 'system', text: 'v15, edited' });
    await repo.evaluatePrompt('tailor.rewrite', 15);
    await repo.publishPrompt('tailor.rewrite', 15);

    const back = await repo.rollbackPrompt('tailor.rewrite', 14);
    expect(back.draft).toBeNull();
    expect(back.editor.system).toContain('- Keep the facts from the source bullet.');
    expect(back.activeEditor?.system).toBe(back.editor.system);
    expect(back.eval).toBeNull();

    // A new draft starts from the live text, with a change note of its own.
    const draft = await repo.createPromptDraft('tailor.rewrite');
    expect(draft.draft?.version).toBe(16);
    expect(draft.editor.system).toBe(back.editor.system);
    expect(draft.changeNote).toBe('');
    expect(draft.eval).toBeNull();
  }, 20_000);

  it('compares an eval with the live version’s own score, and fails an emptied prompt', async () => {
    await repo.savePromptDraft('tailor.rewrite', { tab: 'system', text: 'Rewrite the bullets.' });
    const edited = await repo.evaluatePrompt('tailor.rewrite', 15);
    expect(edited.baseline).toEqual({ version: 14, score: 0.88 });
    expect(edited.checks.map((c) => c.label)).toContain('Keyword coverage');

    await repo.savePromptDraft('tailor.rewrite', { tab: 'system', text: '  ' });
    const empty = await repo.evaluatePrompt('tailor.rewrite', 15);
    expect(empty.passed).toBe(false);
    await expect(repo.publishPrompt('tailor.rewrite', 15)).rejects.toBeInstanceOf(
      EvalRequiredError,
    );
  }, 20_000);

  it('never edits the live text in place', async () => {
    await expect(
      repo.savePromptDraft('resume.parse', { tab: 'system', text: 'edited' }),
    ).rejects.toThrow('Start a draft');
  });

  it('runs the sandbox on the chosen seeded resume, and only with its own job', async () => {
    const run = await repo.runSandbox('tailor.rewrite', {
      resumeId: 'seed-design-lead',
      jobId: 'seed-figma-design',
    });
    expect(run?.resumeId).toBe('seed-design-lead');
    expect(run?.bullets[0]?.before).toContain('designers');
    await expect(
      repo.runSandbox('tailor.rewrite', { resumeId: 'seed-design-lead', jobId: 'seed-stripe-pm' }),
    ).rejects.toThrow('canned run');
  }, 20_000);

  it('dates the older versions upward and keeps every published score at the threshold', async () => {
    const { versions } = await repo.getPrompt('tailor.rewrite');
    const dates = versions.map((v) => new Date(v.createdAt).getTime());
    expect([...dates].sort((a, b) => b - a)).toEqual(dates);
    expect(
      versions.filter((v) => v.status !== 'draft').every((v) => (v.evalScore ?? 1) >= 0.85),
    ).toBe(true);
  });
});

describe('technology KB', () => {
  it('imports the valid rows and lists the invalid ones with a reason', async () => {
    const result = await repo.importTechnologies({
      format: 'csv',
      content: [
        'name,category,aliases,latest_version,release_date,source',
        'Hono,Web framework,hono.js;honojs,4.6,2024-09-10,https://hono.dev',
        ',Runtime,,,,',
        'Zig,Language,,0.13,2024-06-07,',
        'Gleam,Language,,1.5,June 2024,https://gleam.run',
        'Elm,Language,,0.19,2019-10-21,see the blog',
        'Bun,Runtime,,,,',
      ].join('\n'),
    });
    expect(result.imported).toBe(1);
    expect(result.failed).toEqual([
      { row: 2, reason: 'missing a name' },
      { row: 3, reason: 'a release date needs a cited source' },
      { row: 4, reason: 'release date isn’t YYYY-MM-DD' },
      { row: 5, reason: 'the source isn’t a web address (https://…)' },
      { row: 6, reason: 'Bun is already in the KB; edit it instead' },
    ]);
    const queue = await repo.kbQueue();
    expect(queue.at(-1)?.detail.fields).toContainEqual({
      field: 'Aliases',
      from: null,
      to: 'hono.js, honojs',
    });
  });

  it('reads JSON values that aren’t strings, and lists a row it can’t read', async () => {
    const result = await repo.importTechnologies({
      format: 'json',
      content: JSON.stringify([
        { name: 'Deno 2', category: 'JavaScript runtime', aliases: ['deno2'], latest_version: 2.1 },
        { name: 'Odd', category: { nested: true } },
        'not a row',
      ]),
    });
    expect(result.imported).toBe(1);
    expect(result.failed).toEqual([
      { row: 2, reason: 'category isn’t text' },
      { row: 3, reason: 'the row isn’t an object' },
    ]);
    expect(
      (await repo.importTechnologies({ format: 'json', content: '{}' })).failed[0]?.reason,
    ).toBe('the file isn’t a JSON array of rows');
  });

  it('refuses to approve a release date without a cited source, until one is added', async () => {
    await expect(repo.decideChange('chg_go', 'approve')).rejects.toBeInstanceOf(
      SourceRequiredError,
    );
    await expect(
      repo.editChange('chg_go', [{ field: 'Release date', to: '2025-02-11' }], 'go.dev'),
    ).rejects.toBeInstanceOf(SourceUrlError);
    await repo.editChange(
      'chg_go',
      [{ field: 'Release date', to: '2025-02-11' }],
      'https://go.dev/doc/devel/release',
    );
    await repo.decideChange('chg_go', 'approve');
    const go = (
      await repo.listTechnologies({ tab: 'all', query: 'golang', page: 1, dataset: null })
    ).rows[0];
    expect(go?.releaseDate).toBe('2025-02-11T12:00:00.000Z');
    expect(go?.sourceUrl).toBe('https://go.dev/doc/devel/release');

    await repo.decideChange('chg_nextjs', 'approve');
    const stats = await repo.kbStats();
    expect(stats.review).toEqual({ total: 12, fromImports: 8, staffEdits: 4 });
  }, 20_000);

  it('keeps an edit off the entry until it is approved, and a rejection puts it back', async () => {
    const react = (
      await repo.listTechnologies({ tab: 'all', query: 'react', page: 1, dataset: null })
    ).rows[0]!;
    await repo.saveTechnology(
      {
        name: 'React',
        category: 'JavaScript library',
        aliases: [...react.aliases, 'react19'],
        latestVersion: react.latestVersion,
        releaseDate: react.releaseDate,
        sourceUrl: react.sourceUrl,
      },
      react.id,
    );
    const [change] = await repo.kbQueue();
    expect(change?.title).toBe('React · edit');
    expect(change?.kind).toBe('category');
    expect(change?.detail.fields).toEqual([
      { field: 'Category', from: 'UI library', to: 'JavaScript library' },
      { field: 'Aliases', from: 'reactjs, react.js', to: 'reactjs, react.js, react19' },
    ]);
    const held = (
      await repo.listTechnologies({ tab: 'all', query: 'react', page: 1, dataset: null })
    ).rows[0];
    expect(held?.category).toBe('UI library');
    expect(held?.status).toBe('in_review');

    await repo.decideChange(change!.id, 'reject');
    const back = (
      await repo.listTechnologies({ tab: 'all', query: 'react', page: 1, dataset: null })
    ).rows[0];
    expect(back).toMatchObject({ category: 'UI library', status: 'published' });
  });

  it('sends a new entry to the review queue, and drops it if it is rejected', async () => {
    const tech = await repo.saveTechnology({
      name: 'Zig',
      category: 'Programming language',
      aliases: ['ziglang'],
      latestVersion: '0.13',
      releaseDate: null,
      sourceUrl: null,
    });
    expect(tech.status).toBe('in_review');
    const [change] = await repo.kbQueue();
    expect(change?.title).toBe('Zig · new technology');
    expect((await repo.kbStats()).technologies.total).toBe(1285);

    await repo.decideChange(change!.id, 'reject');
    expect((await repo.kbStats()).technologies.total).toBe(1284);
    const found = await repo.listTechnologies({ tab: 'all', query: 'zig', page: 1, dataset: null });
    expect(found.rows).toEqual([]);
  });

  it('counts what each tab lists, and sorts the whole list before paging', async () => {
    const { tabs } = await repo.kbStats();
    expect(tabs).toEqual({ all: 1284, review: 14, reports: 5, imports: 3 });
    const review = await repo.listTechnologies({
      tab: 'review',
      query: '',
      page: 1,
      dataset: null,
    });
    expect(review.total).toBe(14);
    const sorted = await repo.listTechnologies({
      tab: 'review',
      query: '',
      page: 1,
      dataset: null,
      sort: 'asc',
    });
    expect(sorted.rows.map((r) => r.name).slice(0, 3)).toEqual(['Bun', 'Deno', 'Figma']);
  });
});

describe('skills, templates and the rubric', () => {
  it('maps an unmatched term onto a skill as an alias', async () => {
    await repo.mapTerm('Pulumi', 'sk_tf');
    const overview = await repo.skillsOverview();
    expect(overview?.unmapped.map((u) => u.term)).not.toContain('Pulumi');
    const page = await repo.listSkills({
      categoryId: 'cloud',
      filter: 'all',
      query: 'pulumi',
      page: 1,
    });
    expect(page?.rows.map((r) => r.name)).toEqual(['Terraform']);
  });

  it('merging a suggestion keeps the term as an alias of its target skill', async () => {
    await repo.resolveMerge('mg_k8', 'merge');
    const [k8s] =
      (await repo.listSkills({ categoryId: 'cloud', filter: 'all', query: 'kubernetes', page: 1 }))
        ?.rows ?? [];
    expect(k8s?.aliases).toContain('K8');
    expect((await repo.skillsOverview())?.merges.map((m) => m.id)).not.toContain('mg_k8');
  });

  it('finds a skill in any category and sorts by use before paging', async () => {
    const all = await repo.listSkills({ categoryId: null, filter: 'all', query: 'post', page: 1 });
    expect(all?.rows.map((r) => r.name)).toEqual(['PostgreSQL']);
    await repo.addSkill({ name: 'Pulumi', categoryId: 'cloud', parent: 'IaC', aliases: [] });
    const desc = await repo.listSkills({
      categoryId: 'cloud',
      filter: 'with',
      query: '',
      page: 1,
      sort: 'desc',
    });
    const used = desc?.rows.map((r) => r.usedIn) ?? [];
    expect(used).toEqual([...used].sort((a, b) => b - a));
    expect(desc?.rows[0]?.name).toBe('Amazon Web Services');
  });

  it('empties the taxonomy and the rubric in empty mode', async () => {
    useMockModeStore.setState({ mode: 'empty' });
    const overview = await repo.skillsOverview();
    expect(overview?.categories).toEqual([]);
    expect(overview?.stats.skills).toBe(0);
    expect((await repo.rubric()).versions).toEqual([]);
  });

  it('credits an edited rationale to its editor, pending review', async () => {
    const rubric = await repo.saveRationale(['New first paragraph.']);
    expect(rubric.rationale?.byline).toBe('Edited by Ehsan · review pending');
  });

  it('refuses to publish a template that hasn’t passed its ATS check', async () => {
    await expect(repo.setTemplateStatus('executive', 'published')).rejects.toBeInstanceOf(
      NotCertifiedError,
    );
    expect((await repo.setTemplateStatus('classic', 'published')).status).toBe('published');
  });

  it('holds the rubric draft until its sign-off arrives', async () => {
    await expect(repo.publishRubric(4)).rejects.toBeInstanceOf(RubricNotReadyError);
    const rubric = await repo.rubric();
    expect(rubric.versions[0]?.criteria.reduce((sum, c) => sum + c.weight, 0)).toBe(100);
  });
});
