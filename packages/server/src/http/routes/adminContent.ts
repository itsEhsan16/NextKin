import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import * as catalog from '../../services/admin/contentCatalog';
import * as skills from '../../services/admin/contentSkills';
import { requireStaff } from '../../services/admin/permissions';
import type { ApiEnv } from '../env';
import type { AdminRouteDeps } from './admin';
import { admin, auditMeta, errs, idParam, json, ok, staffOnly } from './adminKit';

/**
 * The admin portal's Content routes (`toreview.md` §171.13), beside the prompts, KB, templates and
 * rubric routes in `admin.ts`: the skills editor, new templates and their usage, the rubric's
 * rationale, and the KB's and prompts' own figures. Every handler checks its permission with
 * `requireStaff`; every change is audited in the same transaction as the change.
 */
export function adminContentRoutes(deps: AdminRouteDeps): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();
  app.use('/admin/*', staffOnly);
  const { db } = deps;
  const cm = admin('content.manage');
  const an = admin('analytics.read');
  const tags = ['admin'];

  // --- Skills ----------------------------------------------------------------------------------
  app.openapi(createRoute({ method: 'get', path: '/admin/skills/overview', tags, summary: cm.describe('The skills editor: counts, categories, unmapped terms and merge suggestions (aggregates)'), responses: { 200: ok('The overview.'), ...errs } }), async (c) =>
    c.json(await skills.skillsOverview(db, requireStaff(c, 'content.manage')), 200),
  );
  app.openapi(createRoute({ method: 'get', path: '/admin/skills', tags, summary: cm.describe('Skills, filtered and paged'), request: { query: skills.skillQuerySchema }, responses: { 200: ok('A page of skills.'), ...errs } }), async (c) =>
    c.json(await skills.listSkills(db, requireStaff(c, 'content.manage'), c.req.valid('query')), 200),
  );
  app.openapi(createRoute({ method: 'post', path: '/admin/skills', tags, summary: cm.describe('Add a skill'), request: { body: json(skills.newSkillSchema) }, responses: { 201: ok('The skill.'), ...errs } }), async (c) =>
    c.json(await skills.addSkill(db, requireStaff(c, 'content.manage'), c.req.valid('json'), auditMeta(c)), 201),
  );
  app.openapi(createRoute({ method: 'put', path: '/admin/skills/{id}/aliases', tags, summary: cm.describe('Replace a skill’s aliases'), request: { params: idParam, body: json(z.object({ aliases: skills.aliasesSchema }).strict()) }, responses: { 200: ok('The skill.'), ...errs } }), async (c) =>
    c.json(await skills.setAliases(db, requireStaff(c, 'content.manage'), c.req.valid('param').id, c.req.valid('json').aliases, auditMeta(c)), 200),
  );
  app.openapi(createRoute({ method: 'post', path: '/admin/skills/{id}/terms', tags, summary: cm.describe('Map a term people typed onto a skill, as an alias'), request: { params: idParam, body: json(z.object({ term: z.string().trim().min(1).max(80) }).strict()) }, responses: { 200: ok('The skill.'), ...errs } }), async (c) =>
    c.json(await skills.mapTerm(db, requireStaff(c, 'content.manage'), c.req.valid('param').id, c.req.valid('json').term, auditMeta(c)), 200),
  );
  app.openapi(createRoute({ method: 'post', path: '/admin/skills/merges/resolve', tags, summary: cm.describe('Merge a suggested term into its skill, or dismiss the suggestion'), request: { body: json(z.object({ id: z.string().min(1).max(140), decision: z.enum(['merge', 'dismiss']) }).strict()) }, responses: { 204: { description: 'Resolved.' }, ...errs } }), async (c) => {
    const body = c.req.valid('json');
    await skills.resolveMerge(db, requireStaff(c, 'content.manage'), body.id, body.decision, auditMeta(c));
    return c.body(null, 204);
  });
  app.openapi(createRoute({ method: 'post', path: '/admin/skill-categories', tags, summary: cm.describe('Add a skill category'), request: { body: json(z.object({ name: z.string().trim().min(1).max(60) }).strict()) }, responses: { 201: ok('The category.'), ...errs } }), async (c) =>
    c.json(await skills.addCategory(db, requireStaff(c, 'content.manage'), c.req.valid('json'), auditMeta(c)), 201),
  );

  // --- Templates -------------------------------------------------------------------------------
  app.openapi(createRoute({ method: 'post', path: '/admin/templates', tags, summary: cm.describe('A new draft template, copied from an existing one (publishing still needs Q-06 certification)'), request: { body: json(catalog.newTemplateSchema) }, responses: { 201: ok('The template.'), ...errs } }), async (c) =>
    c.json(await catalog.createTemplate(db, requireStaff(c, 'content.manage'), c.req.valid('json'), auditMeta(c)), 201),
  );
  app.openapi(createRoute({ method: 'get', path: '/admin/templates/usage', tags, summary: cm.describe('Resumes per template (aggregate) and the template each copies'), responses: { 200: ok('Usage.'), ...errs } }), async (c) =>
    c.json({ data: await catalog.templateUsage(db, requireStaff(c, 'content.manage')) }, 200),
  );

  // --- The rubric's rationale ------------------------------------------------------------------
  app.openapi(createRoute({ method: 'get', path: '/admin/rubric/rationale', tags, summary: an.describe('The current rubric version’s rationale and who last edited it'), responses: { 200: ok('The rationale.'), ...errs } }), async (c) =>
    c.json({ data: await catalog.rubricRationale(db, requireStaff(c, 'analytics.read')) }, 200),
  );
  app.openapi(createRoute({ method: 'put', path: '/admin/rubric/rationale', tags, summary: cm.describe('Edit the current rubric version’s rationale (weights and bands ship with the engines)'), request: { body: json(catalog.rationaleSchema) }, responses: { 200: ok('The rationale.'), ...errs } }), async (c) =>
    c.json({ data: await catalog.saveRationale(db, requireStaff(c, 'content.manage'), c.req.valid('json'), auditMeta(c)) }, 200),
  );

  // --- Figures ---------------------------------------------------------------------------------
  app.openapi(createRoute({ method: 'get', path: '/admin/kb/stats', tags, summary: cm.describe('The KB’s exact counts'), responses: { 200: ok('Counts.'), ...errs } }), async (c) =>
    c.json(await catalog.kbStats(db, requireStaff(c, 'content.manage')), 200),
  );
  app.openapi(createRoute({ method: 'get', path: '/admin/prompts/figures', tags, summary: cm.describe('Thirty-day eval pass rate and model cost per finished resume run (aggregates)'), responses: { 200: ok('Figures.'), ...errs } }), async (c) => {
    requireStaff(c, 'content.manage');
    return c.json(await catalog.promptFigures(db), 200);
  });

  return app;
}
