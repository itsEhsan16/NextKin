import { simulate } from '../mock/delay';
import {
  mergesFixture,
  rubricFixture,
  skillCategoriesFixture,
  skillsFixture,
  skillsStatsFixture,
  templatesFixture,
  unmappedFixture,
} from '../mock/fixtures/adminContent';
import {
  NotCertifiedError,
  RubricNotReadyError,
  type KbChange,
  type KbImportResult,
  type KbStats,
  type KbTab,
  type ResumeTemplate,
  type RubricOverview,
  type Skill,
  type SkillPage,
  type SkillsAliasFilter,
  type SkillsOverview,
  type Technology,
  type TechnologyInput,
  type TechnologyPage,
  type TemplateStatus,
} from '../models/adminContent';

import { recordAdminAudit } from './adminAuditLog';
import { createMockKbMethods } from './adminContentKbMock';
import { onAdminMockReset } from './adminMockReset';
import { createMockPromptsRepo, type AdminPromptsRepo } from './adminPromptsRepo';
import { clone, NotFoundError } from './state';

export { KB_PAGE_SIZE } from './adminContentKbMock';
export const SKILLS_PAGE_SIZE = 8;

/**
 * `dataset` narrows to one dataset version ("v2026.11"); `null` for every version. `sort` orders by
 * name before paging, so the order holds across pages; absent keeps the KB's own order.
 */
export type TechnologyQuery = {
  tab: KbTab;
  query: string;
  page: number;
  dataset: string | null;
  sort?: 'asc' | 'desc' | null;
};
/**
 * `categoryId` `null` searches every category (the map dialog's picker). `sort` orders by how many
 * resumes use a skill, before paging, so the order holds across pages; absent keeps the taxonomy's.
 */
export type SkillQuery = {
  categoryId: string | null;
  filter: SkillsAliasFilter;
  query: string;
  page: number;
  sort?: 'asc' | 'desc' | null;
};

/**
 * The admin portal's Content area (V2 §7.17, P12-03/P12-04; Figma 406:662–410:1771): prompts and
 * their versions, the technology KB and its review queue, skills and aliases, templates, the ATS
 * rubric. A part the source doesn't serve resolves to `null`; a write it can't make throws
 * `ContentNotServedError`.
 */
export interface AdminContentRepo extends AdminPromptsRepo {
  // AI prompts: `AdminPromptsRepo` (`adminPromptsRepo.ts`)

  // Technology KB
  kbStats(): Promise<KbStats>;
  listTechnologies(query: TechnologyQuery): Promise<TechnologyPage>;
  /** A new or edited entry goes to the review queue; nothing is published directly. */
  saveTechnology(input: TechnologyInput, id?: string): Promise<Technology>;
  importTechnologies(file: { format: 'csv' | 'json'; content: string }): Promise<KbImportResult>;
  kbQueue(): Promise<KbChange[]>;
  /** Approving a date without a cited source is refused (`SourceRequiredError`). */
  decideChange(id: string, decision: 'approve' | 'reject'): Promise<void>;
  /** Replaces the proposed values; `source` (a URL, or `null` to drop it) cites the change. */
  editChange(
    id: string,
    fields: { field: string; to: string }[],
    source?: string | null,
  ): Promise<KbChange>;

  // Skills & aliases (not served by the backend yet: `null`)
  skillsOverview(): Promise<SkillsOverview | null>;
  listSkills(query: SkillQuery): Promise<SkillPage | null>;
  addSkill(input: {
    name: string;
    categoryId: string;
    parent: string;
    aliases: string[];
  }): Promise<Skill>;
  setAliases(skillId: string, aliases: string[]): Promise<Skill>;
  mapTerm(term: string, skillId: string): Promise<void>;
  resolveMerge(id: string, decision: 'merge' | 'dismiss'): Promise<void>;
  addCategory(name: string): Promise<void>;

  // Templates
  listTemplates(): Promise<ResumeTemplate[]>;
  /** Publishing an uncertified template is refused (`NotCertifiedError`). */
  setTemplateStatus(slug: string, status: TemplateStatus): Promise<ResumeTemplate>;
  createTemplate(input: { name: string; basedOn: string }): Promise<ResumeTemplate>;

  // ATS rubric
  rubric(): Promise<RubricOverview>;
  /** Refused (`RubricNotReadyError`) until the draft's checklist is complete. */
  publishRubric(version: number): Promise<RubricOverview>;
  saveRationale(paragraphs: string[]): Promise<RubricOverview>;
}

type State = {
  skills: Skill[];
  categories: typeof skillCategoriesFixture;
  unmapped: typeof unmappedFixture;
  merges: typeof mergesFixture;
  skillsStats: typeof skillsStatsFixture;
  templates: ResumeTemplate[];
  rubric: RubricOverview;
};

const fresh = (): State => ({
  skills: clone(skillsFixture),
  categories: clone(skillCategoriesFixture),
  unmapped: clone(unmappedFixture),
  merges: clone(mergesFixture),
  skillsStats: clone(skillsStatsFixture),
  templates: clone(templatesFixture),
  rubric: clone(rubricFixture),
});

const STAFF = 'Ehsan';
const now = () => new Date().toISOString();

export function createMockAdminContentRepo(): AdminContentRepo {
  let state = fresh();
  onAdminMockReset(() => {
    state = fresh();
  });

  const skillOf = (id: string) => {
    const found = state.skills.find((s) => s.id === id);
    if (!found) throw new NotFoundError('Skill', id);
    return found;
  };

  const kb = createMockKbMethods();
  const prompts = createMockPromptsRepo();

  return {
    ...prompts,
    ...kb,

    skillsOverview: () =>
      simulate<SkillsOverview | null>(
        () => ({
          stats: clone(state.skillsStats),
          categories: clone(state.categories),
          unmapped: clone(state.unmapped),
          merges: clone(state.merges),
        }),
        {
          empty: () => ({
            stats: { skills: 0, added30d: 0, aliases: 0, perSkill: 0, merges: 0, unmapped: 0 },
            categories: [],
            unmapped: [],
            merges: [],
          }),
        },
      ),

    listSkills: ({ categoryId, filter, query, page, sort }) =>
      simulate<SkillPage | null>(
        () => {
          const needle = query.trim().toLowerCase();
          const rows = state.skills.filter((s) => {
            if (categoryId !== null && s.categoryId !== categoryId) return false;
            if (filter === 'with' && s.aliases.length === 0) return false;
            if (filter === 'none' && s.aliases.length > 0) return false;
            return !needle || [s.name, ...s.aliases].some((v) => v.toLowerCase().includes(needle));
          });
          // Cloud & DevOps unfiltered is the board's 412 skills (52 pages); the fixture holds the
          // first page, so later pages come back empty.
          const category = state.categories.find((c) => c.id === categoryId);
          const total =
            categoryId === 'cloud' && filter === 'all' && !needle
              ? (category?.count ?? rows.length)
              : rows.length;
          if (sort)
            rows.sort((a, b) => (sort === 'desc' ? b.usedIn - a.usedIn : a.usedIn - b.usedIn));
          const start = (page - 1) * SKILLS_PAGE_SIZE;
          return {
            rows: clone(rows.slice(start, start + SKILLS_PAGE_SIZE)),
            total,
            page,
            pageSize: SKILLS_PAGE_SIZE,
          };
        },
        { empty: () => ({ rows: [], total: 0, page: 1, pageSize: SKILLS_PAGE_SIZE }) },
      ),

    addSkill: (input) =>
      simulate(() => {
        const created: Skill = {
          id: `sk_${Date.now()}`,
          name: input.name,
          aliases: input.aliases,
          parent: input.parent,
          categoryId: input.categoryId,
          usedIn: 0,
          editedAt: now(),
          editedBy: STAFF,
        };
        state.skills.unshift(created);
        state.skillsStats.skills += 1;
        state.skillsStats.added30d += 1;
        state.skillsStats.aliases += input.aliases.length;
        const category = state.categories.find((c) => c.id === input.categoryId);
        if (category) category.count += 1;
        recordAdminAudit('Added skill', 'technology', `skill ${created.name}`);
        return clone(created);
      }),

    setAliases: (skillId, aliases) =>
      simulate(() => {
        const found = skillOf(skillId);
        state.skillsStats.aliases += aliases.length - found.aliases.length;
        found.aliases = aliases;
        recordAdminAudit('Changed skill aliases', 'technology', `skill ${found.name}`);
        found.editedAt = now();
        found.editedBy = STAFF;
        return clone(found);
      }),

    mapTerm: (term, skillId) =>
      simulate(() => {
        const found = skillOf(skillId);
        if (!found.aliases.includes(term)) found.aliases.push(term);
        found.editedAt = now();
        found.editedBy = STAFF;
        state.unmapped = state.unmapped.filter((u) => u.term !== term);
        recordAdminAudit('Mapped a term', 'technology', `skill ${found.name}`, term);
        state.skillsStats.unmapped = Math.max(0, state.skillsStats.unmapped - 1);
        state.skillsStats.aliases += 1;
      }),

    resolveMerge: (id, decision) =>
      simulate(() => {
        const suggestion = state.merges.find((m) => m.id === id);
        if (!suggestion) throw new NotFoundError('MergeSuggestion', id);
        if (decision === 'merge') {
          // Merging keeps the term as an alias of its target, so the target has to exist.
          const target = state.skills.find(
            (s) => s.name.toLowerCase() === suggestion.target.toLowerCase(),
          );
          if (!target) throw new NotFoundError('Skill', suggestion.target);
          if (!target.aliases.some((a) => a.toLowerCase() === suggestion.alias.toLowerCase())) {
            target.aliases.push(suggestion.alias);
            state.skillsStats.aliases += 1;
          }
          target.editedAt = now();
          target.editedBy = STAFF;
        }
        state.merges = state.merges.filter((m) => m.id !== id);
        recordAdminAudit(
          decision === 'merge' ? 'Merged skill alias' : 'Dismissed merge',
          'technology',
          `skill ${suggestion.target}`,
          suggestion.alias,
        );
        state.skillsStats.merges = Math.max(0, state.skillsStats.merges - 1);
      }),

    addCategory: (name) =>
      simulate(() => {
        state.categories.push({ id: `cat_${Date.now()}`, name, count: 0 });
        recordAdminAudit('Added skill category', 'technology', `category ${name}`);
      }),

    listTemplates: () => simulate(() => clone(state.templates), { empty: () => [] }),

    setTemplateStatus: (slug, status) =>
      simulate(() => {
        const template = state.templates.find((t) => t.slug === slug);
        if (!template) throw new NotFoundError('Template', slug);
        if (status === 'published' && !template.atsSafe) throw new NotCertifiedError(template.name);
        template.status = status;
        recordAdminAudit(
          `${{ published: 'Published', archived: 'Archived', draft: 'Unpublished' }[status]} template`,
          'prompt',
          `template ${slug}`,
        );
        template.archivedAt = status === 'archived' ? now() : null;
        template.editedAt = now();
        template.editedBy = STAFF;
        return clone(template);
      }),

    createTemplate: ({ name, basedOn }) =>
      simulate(() => {
        const base = state.templates.find((t) => t.slug === basedOn);
        if (!base) throw new NotFoundError('Template', basedOn);
        const created: ResumeTemplate = {
          slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
          name,
          layout: base.layout,
          atsSafe: false,
          status: 'draft',
          rev: 1,
          inUse: 0,
          editedAt: now(),
          editedBy: STAFF,
          archivedAt: null,
        };
        state.templates.push(created);
        recordAdminAudit('Created template', 'prompt', `template ${created.slug}`);
        return clone(created);
      }),

    rubric: () =>
      simulate(() => clone(state.rubric), {
        empty: (): RubricOverview => ({
          versions: [],
          checklist: [],
          rationale: null,
          impact: null,
        }),
      }),

    publishRubric: (version) =>
      simulate(() => {
        const pending = state.rubric.checklist.find((c) => c.state === 'pending');
        if (pending) throw new RubricNotReadyError(pending.label.toLowerCase());
        for (const v of state.rubric.versions) {
          if (v.status === 'active') v.status = 'retired';
          if (v.version === version) {
            v.status = 'active';
            v.activeSince = 'today';
            v.dateLabel = 'published today';
          }
        }
        state.rubric.checklist = [];
        recordAdminAudit('Published rubric', 'prompt', `rubric v${version}`);
        return clone(state.rubric);
      }),

    saveRationale: (paragraphs) =>
      simulate(() => {
        if (state.rubric.rationale) {
          state.rubric.rationale.paragraphs = paragraphs;
          // The text is now this staff member's, and no one has reviewed it yet.
          state.rubric.rationale.byline = `Edited by ${STAFF} · review pending`;
          recordAdminAudit('Edited rubric rationale', 'prompt', 'rubric');
        }
        return clone(state.rubric);
      }),
  };
}
