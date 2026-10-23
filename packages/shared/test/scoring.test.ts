/// <reference types="vite/client" />
import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { resolveSkill } from '@nextkin/engines/normalizer';
import { beforeEach, describe, expect, it } from 'vitest';

import { configureMockPlatform } from '../src/mock/platform';
import type { ResumeContent } from '../src/models';
import { createMockRepos } from '../src/repos';
import { rescoreStored } from '../src/repos/scoring';
import { createMockStore, type MockStore } from '../src/repos/state';
import { parsePeriod } from '../src/scoring/adapters';

/**
 * C-10 (ImBackendImplementationPlan P8-10): every score the mock returns comes from
 * `packages/engines`, and no mock path can insert an unbacked keyword or an invented bullet.
 */

const bulletsOf = (store: MockStore) =>
  Object.values(store.state.contents).flatMap((c) => (c.kind === 'resume' ? c.experience.flatMap((r) => r.bullets) : []));

/** Takes two profile-backed skills off a document, so its panel has fixes the product may make. */
function withBackedGaps(store: MockStore, id: string, jd: { requiredSkills: string[]; preferredSkills: string[] }) {
  const content = store.state.contents[id] as ResumeContent;
  const drop = (skills: string[] = []) => skills.filter((s) => !jd.requiredSkills.includes(s));
  const edited = { ...content, skills: drop(content.skills), experience: content.experience.map((r) => ({ ...r, skills: drop(r.skills) })) };
  store.state.contents[id] = edited;
  store.state.scoringJds[id] = { ...jd, tools: [], rawText: '', completeness: 'snippet' };
  return rescoreStored(store.state, id, edited);
}

describe.each(['mobile', 'web'] as const)('the %s seed', (platform) => {
  let store: MockStore;
  beforeEach(() => {
    configureMockPlatform(platform);
    store = createMockStore();
  });

  it('scores every document from the engines, and a document with no JD has no total (D-15)', () => {
    for (const resume of store.state.resumes) {
      const score = store.state.atsScores[resume.id];
      if (!score) {
        expect(resume.atsScore, resume.id).toBeUndefined();
        continue;
      }
      expect(store.state.scoringJds[resume.id], resume.id).toBeDefined();
      expect(score.report?.provenance).toMatchObject({ engine: '1.0.0', rubric: 'rubric-2', taxonomy: 'taxonomy-0.1.0', kb: 'kb-0.1.0' });
      expect(resume.atsScore).toBe(score.total);
      expect(score.report?.total).toBe(score.total);
    }
    const unscoredWithoutJd = store.state.resumes.filter((r) => r.docType === 'resume' && !r.linkedJobId && store.state.contents[r.id]);
    expect(unscoredWithoutJd.length).toBeGreaterThan(0);
    for (const resume of unscoredWithoutJd) expect(store.state.atsScores[resume.id]).toBeUndefined();
  });
});

describe('fixes the mock may make (C-10)', () => {
  let store: MockStore;
  beforeEach(() => {
    configureMockPlatform('mobile');
    store = createMockStore();
  });

  it('applies only skills the profile backs, and never a gap or a figure', async () => {
    const repos = createMockRepos(store);
    const score = withBackedGaps(store, 'res_zoho', { requiredSkills: ['Figma', 'Prototyping'], preferredSkills: ['Kubernetes'] });
    const items = score!.sections.flatMap((s) => s.items).filter((i) => !i.passed);
    const refusable = items.filter((i) => !i.fixable);
    expect(refusable.length).toBeGreaterThan(0);
    for (const item of refusable) await expect(repos.resumes.applyAtsFix('res_zoho', item.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });

    const backedIds = new Set([
      ...store.state.profile.skills,
      ...store.state.profile.experiences.flatMap((e) => e.skills),
    ].map((s) => resolveSkill(TAXONOMY, s).id));
    const before = bulletsOf(store);
    for (const item of items.filter((i) => i.fixable)) {
      const { content } = await repos.resumes.applyAtsFix('res_zoho', item.id);
      if (content.kind !== 'resume') throw new Error('a resume');
      const added = [...content.skills, ...content.experience.flatMap((r) => r.skills ?? [])];
      for (const skill of added) expect(backedIds.has(resolveSkill(TAXONOMY, skill).id), skill).toBe(true);
    }
    // No fix wrote a bullet: the bodies hold exactly the bullets they had.
    expect(bulletsOf(store)).toEqual(before);
    const after = store.state.atsScores.res_zoho!;
    expect(after.total).toBeGreaterThan(score!.total);
    expect(after.report?.requirements.find((r) => r.text === 'Kubernetes')?.status).toBe('gap');
  });

  it('a skill the profile does not back, typed in by hand, earns nothing', async () => {
    const repos = createMockRepos(store);
    const before = store.state.atsScores.res_2!;
    const content = store.state.contents.res_2 as ResumeContent;
    await repos.resumes.updateSection('res_2', 'skills', [...content.skills, 'Fintech']);
    const after = store.state.atsScores.res_2!;
    expect(after.total).toBe(before.total);
    expect(after.report?.unbacked).toContain('Fintech');
  });

  it('every typed fix carries a type the contract names, and only a backed skill is insertable', () => {
    const score = withBackedGaps(store, 'res_zoho', { requiredSkills: ['Figma'], preferredSkills: ['Kubernetes'] });
    for (const fix of score!.report!.fixes) {
      expect(['surface_backed_skill', 'gap', 'ask_for_number', 'complete_section', 'formatting', 'mirror_wording', 'resolve_timeline']).toContain(fix.type);
      expect(fix.insertable).toBe(fix.type === 'surface_backed_skill');
      if (fix.type === 'gap') expect(fix.impact).toBe(0);
    }
  });

  it('no mock source keeps the rules C-10 removed', () => {
    const banned = /COMPLETED_SCORE|KEYWORD_CEILING|RESCORE_STEP|QUANTIFIED_BULLET|legacyScore|scoreFromKeywords|atsScoresFixture/;
    // Read through Vite rather than node:fs: this package's lint fence keeps Node built-ins out.
    const sources = import.meta.glob<string>('../src/**/*.ts', { query: '?raw', import: 'default', eager: true });
    expect(Object.keys(sources).length).toBeGreaterThan(50);
    for (const [file, text] of Object.entries(sources)) expect(text, file).not.toMatch(banned);
  });
});

describe('reading a printed period', () => {
  it('turns every form the fixtures and boards use into dates, and never guesses', () => {
    expect(parsePeriod('Mar 2022 — Present')).toEqual({ start: { year: 2022, month: 3 }, end: null });
    expect(parsePeriod('Jun 2020 – Dec 2021')).toEqual({ start: { year: 2020, month: 6 }, end: { year: 2021, month: 12 } });
    expect(parsePeriod('2014 — 2016')).toEqual({ start: { year: 2014 }, end: { year: 2016 } });
    expect(parsePeriod('2019-2021')).toEqual({ start: { year: 2019 }, end: { year: 2021 } });
    expect(parsePeriod('03/2018 - heute')).toEqual({ start: { year: 2018, month: 3 }, end: null });
    expect(parsePeriod('Spring term')).toEqual({});
  });
});
