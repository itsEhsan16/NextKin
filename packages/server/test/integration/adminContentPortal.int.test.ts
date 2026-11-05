import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { searchAudit } from '../../src/services/admin/audit';
import * as catalog from '../../src/services/admin/contentCatalog';
import * as skills from '../../src/services/admin/contentSkills';
import type { Staff } from '../../src/services/admin/permissions';
import { mobileLogin, registered, startHarness, type Harness } from './fixtures/authHarness';

/**
 * The admin portal's Content routes against Postgres (toreview §171.13): the skills editor over the
 * reviewed taxonomy copy, with usage counted in distinct people and terms listed only from two
 * people up; merge suggestions decided by code and remembered when dismissed; draft template
 * copies that still need certification; the rubric's rationale edited against its version; and
 * every change audited.
 */
let h: Harness;
const meta = { ip: '127.0.0.1', requestId: 'req-admin-content-test' };
const tag = randomUUID().slice(0, 6);
let originalRationale: { version: string; rationale: string } | undefined;

beforeAll(async () => {
  h = await startHarness({});
  originalRationale = await h.db.withSystem('test: keep the rubric rationale', (tx) => tx.selectFrom('rubric_versions').select(['version', 'rationale']).where('is_current', '=', true).executeTakeFirst());
});
afterAll(async () => {
  const curator = { userId: randomUUID(), role: 'curator' } as const;
  await h.db.withUser(curator, (tx) => tx.deleteFrom('skills').where('canonical_name', 'like', 'AdminTest%').execute());
  await h.db.withUser(curator, (tx) => tx.deleteFrom('skill_categories').where('id', 'like', 'admintest-%').execute());
  await h.db.withUser(curator, (tx) => tx.deleteFrom('resume_templates').where('slug', 'like', 'admintest-%').execute());
  if (originalRationale) {
    await h.db.withUser({ userId: randomUUID(), role: 'admin' }, (tx) => tx.updateTable('rubric_versions').set({ rationale: originalRationale!.rationale, rationale_updated_by: null, rationale_updated_at: null }).where('version', '=', originalRationale!.version).execute());
  }
  await h.db.withSystem('test: tidy staff rows', (tx) => tx.deleteFrom('users').where('email', 'like', '%@nkt-content.test').execute());
  await h.close();
});

async function staffMember(level: Staff['level']): Promise<Staff> {
  const userId = randomUUID();
  const email = `staff-${level}-${userId.slice(0, 8)}@nkt-content.test`;
  await h.db.withUser({ userId, role: 'user' }, (tx) => tx.insertInto('users').values({ id: userId, identity_sub: `local|staff-${userId}`, email, first_name: 'Marco', last_name: 'Keller', role: level === 'super_admin' ? 'admin' : level }).execute());
  return { identity: { userId, role: level === 'super_admin' ? 'admin' : level }, level };
}

/** A signed-up person who typed these skills into their profile. */
async function personTyping(...names: string[]) {
  const email = await registered(h);
  await mobileLogin(h, email);
  const user = await h.db.withSystem('test: find the user', (tx) => tx.selectFrom('users').select('id').where('email', '=', email).executeTakeFirstOrThrow());
  await h.db.withUser({ userId: user.id, role: 'user' }, (tx) => tx.insertInto('profile_skills').values(names.map((raw_name) => ({ user_id: user.id, raw_name }))).execute());
  return user.id;
}

describe('the skills editor', () => {
  const zeta = `AdminTest Zeta ${tag}`;
  const lonely = `admintest-lonely-${tag}`;
  const shared = `admintest-shared-${tag}`;
  const loose = `AdminTestZeta${tag}JS`;

  it('adds a category and a skill, refuses a word another skill holds, and audits both', async () => {
    const curator = await staffMember('curator');
    const category = await skills.addCategory(h.db, curator, { name: `admintest ${tag}` }, meta);
    expect(category).toMatchObject({ id: `admintest-${tag}`, count: 0 });
    await expect(skills.addCategory(h.db, curator, { name: `AdminTest ${tag}` }, meta)).rejects.toMatchObject({ code: 'CONFLICT' });

    const created = await skills.addSkill(h.db, curator, { name: zeta, categoryId: category.id, parent: 'Testing', aliases: [`zt-${tag}`, `ZT-${tag}`] }, meta);
    // Aliases are kept once, whatever their case; nobody typed it yet.
    expect(created).toMatchObject({ name: zeta, aliases: [`zt-${tag}`], categoryId: category.id, parent: 'Testing', usedIn: 0, editedBy: 'Marco K.' });
    await expect(skills.addSkill(h.db, curator, { name: `AdminTest Other ${tag}`, aliases: [zeta.toUpperCase()] }, meta)).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(skills.addSkill(h.db, curator, { name: `AdminTest Nowhere ${tag}`, categoryId: 'no-such-category', aliases: [] }, meta)).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

    const audit = await searchAudit(h.db, await staffMember('admin'), { actor: curator.identity.userId });
    expect(audit.map((r) => r.action).sort()).toEqual(['skill.category_create', 'skill.create']);
  });

  it('counts people, not rows, and lists a typed term only once two people used it', async () => {
    const curator = await staffMember('curator');
    await personTyping(zeta, lonely, shared, loose);
    await personTyping(`zt-${tag}`, shared, loose);

    const page = await skills.listSkills(h.db, curator, { q: zeta, aliases: 'all', page: 1, pageSize: 8, sort: 'asc' });
    expect(page.total).toBe(1);
    // One by its name, one by its alias: two people.
    expect(page.data[0]).toMatchObject({ name: zeta, usedIn: 2 });

    const overview = await skills.skillsOverview(h.db, curator);
    const terms = overview.unmapped.map((t) => t.term);
    expect(terms).toContain(shared);
    expect(terms).not.toContain(lonely);
    // "…JS" loosely names the skill: a merge suggestion, not an unmapped term.
    expect(terms).not.toContain(loose);
    expect(overview.merges.find((m) => m.alias === loose)).toMatchObject({ target: zeta, seenIn: 2 });
    expect(overview.categories.find((c) => c.id === `admintest-${tag}`)).toMatchObject({ count: 1 });
  });

  it('maps a term onto a skill, and a merge suggestion merges or stays dismissed', async () => {
    const curator = await staffMember('curator');
    const [found] = (await skills.listSkills(h.db, curator, { q: zeta, aliases: 'all', page: 1, pageSize: 8, sort: 'asc' })).data;
    const mapped = await skills.mapTerm(h.db, curator, found!.id, shared, meta);
    expect(mapped.aliases).toContain(shared);
    expect((await skills.skillsOverview(h.db, curator)).unmapped.map((t) => t.term)).not.toContain(shared);

    const suggestion = (await skills.skillsOverview(h.db, curator)).merges.find((m) => m.alias === loose)!;
    await skills.resolveMerge(h.db, curator, suggestion.id, 'dismiss', meta);
    const after = await skills.skillsOverview(h.db, curator);
    expect(after.merges.find((m) => m.alias === loose)).toBeUndefined();
    // Dismissed, it doesn't fall back into the unmapped list either.
    expect(after.unmapped.map((t) => t.term)).not.toContain(loose);
    await expect(skills.resolveMerge(h.db, curator, suggestion.id, 'merge', meta)).rejects.toMatchObject({ code: 'NOT_FOUND' });

    const audit = await searchAudit(h.db, await staffMember('admin'), { actor: curator.identity.userId });
    expect(audit.map((r) => r.action).sort()).toEqual(['skill.map_term', 'skill.merge_dismiss']);
  });

  it('replaces aliases, refusing one another skill already uses', async () => {
    const curator = await staffMember('curator');
    const other = await skills.addSkill(h.db, curator, { name: `AdminTest Eta ${tag}`, aliases: [`eta-${tag}`] }, meta);
    const [found] = (await skills.listSkills(h.db, curator, { q: zeta, aliases: 'all', page: 1, pageSize: 8, sort: 'asc' })).data;
    await expect(skills.setAliases(h.db, curator, found!.id, [`eta-${tag}`], meta)).rejects.toMatchObject({ code: 'CONFLICT' });
    const saved = await skills.setAliases(h.db, curator, found!.id, [`zeta-${tag}`], meta);
    expect(saved.aliases).toEqual([`zeta-${tag}`]);
    expect((await skills.listSkills(h.db, curator, { q: `AdminTest`, aliases: 'none', page: 1, pageSize: 50, sort: 'asc' })).data.map((s) => s.id)).not.toContain(other.id);
  });
});

describe('templates, the rubric and the figures', () => {
  it('a new template is an uncertified draft copy, and usage counts live resumes', async () => {
    const curator = await staffMember('curator');
    const bases = await h.db.withUser({ userId: curator.identity.userId, role: 'curator' }, (tx) => tx.selectFrom('resume_templates').select('slug').where('slug', 'not like', 'admintest-%').limit(1).execute());
    if (!bases[0]) return; // a stack without seeded templates has nothing to copy
    const created = await catalog.createTemplate(h.db, curator, { name: `admintest ${tag}`, basedOn: bases[0].slug }, meta);
    expect(created).toMatchObject({ slug: `admintest-${tag}`, status: 'draft', certified_at: null });
    await expect(catalog.createTemplate(h.db, curator, { name: `AdminTest ${tag}`, basedOn: bases[0].slug }, meta)).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(catalog.createTemplate(h.db, curator, { name: 'admintest nothing', basedOn: 'no-such-template' }, meta)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const usage = await catalog.templateUsage(h.db, curator);
    expect(usage.find((u) => u.slug === created.slug)).toEqual({ slug: created.slug, inUse: 0, basedOn: bases[0].slug });
  });

  it('edits the current rubric’s rationale only against its version, and names the editor', async () => {
    const curator = await staffMember('curator');
    const current = await catalog.rubricRationale(h.db, curator);
    if (!current) return; // no seeded rubric
    await expect(catalog.saveRationale(h.db, curator, { version: 'v0-probe', paragraphs: ['x'] }, meta)).rejects.toMatchObject({ code: 'CONFLICT' });
    const saved = await catalog.saveRationale(h.db, curator, { version: current.version, paragraphs: [`First ${tag}.`, 'Second.'] }, meta);
    expect(saved).toMatchObject({ version: current.version, paragraphs: [`First ${tag}.`, 'Second.'], updatedBy: 'Marco K.' });
    const audit = await searchAudit(h.db, await staffMember('admin'), { actor: curator.identity.userId });
    expect(audit.map((r) => r.action)).toEqual(['rubric.rationale']);
  });

  it('the KB and prompt figures are counts from rows, null where nothing measured them', async () => {
    const curator = await staffMember('curator');
    const kb = await catalog.kbStats(h.db, curator);
    expect(kb.total).toBeGreaterThanOrEqual(kb.inReview);
    expect(kb.added30d).toBeLessThanOrEqual(kb.total);
    const figures = await catalog.promptFigures(h.db);
    for (const window of [figures.current, figures.previous]) {
      expect(window.evalPassRate === null).toBe(window.evaluations === 0);
      expect(window.costPerResumeUsd === null).toBe(window.resumeRuns === 0);
    }
  });
});
