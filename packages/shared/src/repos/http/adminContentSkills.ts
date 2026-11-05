import type { Skill, SkillsOverview } from '../../models/adminContent';
import { skillPageWire, skillsOverviewWire, skillWire, type SkillWire } from '../../schemas/adminContent';
import { SKILLS_PAGE_SIZE, type AdminContentRepo } from '../adminContentRepo';
import type { HttpClient } from './client';

/**
 * The skills editor half of the HTTP `AdminContentRepo`: `services/admin/contentSkills.ts` over
 * `/api/v1/admin/skills` (toreview §171.13). It edits the reviewed copy of the skill taxonomy; live
 * scoring keeps the engines' compiled taxonomy until a release imports it. Usage counts are distinct
 * people, and a typed term is listed only once two or more people used it.
 */

type SkillMethods = Pick<
  AdminContentRepo,
  'skillsOverview' | 'listSkills' | 'addSkill' | 'setAliases' | 'mapTerm' | 'resolveMerge' | 'addCategory'
>;

/** The route's `q` is at most 120 characters. */
const QUERY_MAX = 120;

export const toSkill = (s: SkillWire): Skill => ({
  id: s.id,
  name: s.name,
  aliases: s.aliases,
  parent: s.parent,
  // A skill without a category matches no category filter; '' is never a category id.
  categoryId: s.categoryId ?? '',
  usedIn: s.usedIn,
  editedAt: s.editedAt,
  // Seeded from the engines' taxonomy, with no staff editor yet.
  editedBy: s.editedBy ?? '—',
});

export function createHttpSkillMethods(http: HttpClient): SkillMethods {
  const path = (id: string) => `/admin/skills/${encodeURIComponent(id)}`;
  return {
    skillsOverview: async (): Promise<SkillsOverview> => {
      const raw = skillsOverviewWire.parse(await http.request('/admin/skills/overview'));
      return {
        stats: raw.stats,
        categories: raw.categories,
        unmapped: raw.unmapped,
        merges: raw.merges.map(({ id, alias, target, seenIn, firstSeen }) => ({
          id,
          alias,
          target,
          seenIn,
          firstSeen,
        })),
      };
    },

    listSkills: async ({ categoryId, filter, query, page, sort }) => {
      const q = query.trim().slice(0, QUERY_MAX);
      const raw = skillPageWire.parse(
        await http.request('/admin/skills', {
          query: {
            ...(categoryId ? { category: categoryId } : {}),
            aliases: filter,
            ...(q ? { q } : {}),
            page,
            pageSize: SKILLS_PAGE_SIZE,
            sort: sort === 'desc' ? 'desc' : 'asc',
          },
        }),
      );
      return { rows: raw.data.map(toSkill), total: raw.total, page: raw.page, pageSize: raw.pageSize };
    },

    addSkill: async ({ name, categoryId, parent, aliases }) =>
      toSkill(
        skillWire.parse(
          await http.request('/admin/skills', {
            body: { name, categoryId: categoryId || null, parent, aliases },
          }),
        ),
      ),

    setAliases: async (skillId, aliases) =>
      toSkill(
        skillWire.parse(
          await http.request(`${path(skillId)}/aliases`, { method: 'PUT', body: { aliases } }),
        ),
      ),

    mapTerm: async (term, skillId) => {
      await http.request(`${path(skillId)}/terms`, { body: { term } });
    },

    resolveMerge: async (id, decision) => {
      await http.request('/admin/skills/merges/resolve', { body: { id, decision } });
    },

    addCategory: async (name) => {
      await http.request('/admin/skill-categories', { body: { name } });
    },
  };
}
