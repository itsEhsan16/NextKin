import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import type { Database } from '../../db/database';
import * as skills from '../../services/skillsExplorer';
import type { ApiEnv } from '../env';
import { checked } from '../respond';
import { commonErrors, notFoundError } from './common';

/**
 * The Skills Explorer's public reads (spec §7.14; ImBackendImplementationPlan P11-07). No session:
 * published entries only, and anything else is a 404. Responses are cacheable at the edge for a
 * few minutes, the same cycle the pages' ISR will use. The sitemap lists published entries only.
 */

const ok = <S extends z.ZodType>(description: string, schema: S) => ({ description, content: { 'application/json': { schema } } });
const PUBLIC_CACHE = 'public, max-age=300, stale-while-revalidate=3600';

const skillSchema = z.object({
  slug: z.string(),
  name: z.string(),
  category: z.string(),
  aliases: z.array(z.string()),
  releaseYear: z.number().nullable(),
  safeUsageYear: z.number().nullable(),
  enterpriseAdoptionYear: z.number().nullable(),
  latestVersion: z.string().nullable(),
  status: z.string(),
  sourceCitation: z.string().nullable(),
  updatedAt: z.string(),
});
const skillPageSchema = z.object({ data: z.array(skillSchema), nextOffset: z.number().nullable() });
const skillDetailSchema = skillSchema.extend({ related: z.array(z.object({ slug: z.string(), name: z.string(), kind: z.string() })) });
const trendingSchema = z.object({ data: z.array(z.object({ slug: z.string(), name: z.string(), category: z.string(), rank: z.number(), computedAt: z.string() })) });

const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

export function skillRoutes(deps: { db: Database; appOrigin: string }): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();
  const { db } = deps;

  app.openapi(
    createRoute({
      method: 'get',
      path: '/public/skills',
      tags: ['skills'],
      summary: 'Published technologies, by name; filter by category or a name fragment.',
      request: { query: z.object({ category: z.string().max(80).optional(), q: z.string().trim().max(80).optional(), offset: z.coerce.number().int().min(0).max(100_000).optional() }) },
      responses: { 200: ok('A page of entries.', skillPageSchema), ...commonErrors },
    }),
    async (c) => {
      c.header('Cache-Control', PUBLIC_CACHE);
      return c.json(checked(skillPageSchema, await skills.listSkills(db, c.req.valid('query'))), 200);
    },
  );

  app.openapi(createRoute({ method: 'get', path: '/public/skills/trending', tags: ['skills'], summary: 'Trending technologies, from anonymous aggregates over 30 days (at least 10 users each).', responses: { 200: ok('Ranked entries.', trendingSchema), ...commonErrors } }), async (c) => {
    c.header('Cache-Control', PUBLIC_CACHE);
    return c.json(checked(trendingSchema, { data: await skills.trendingSkills(db) }), 200);
  });

  app.openapi(
    createRoute({ method: 'get', path: '/public/skills/{slug}', tags: ['skills'], summary: 'One published technology with its published relations; anything else is a 404.', request: { params: z.object({ slug: z.string().max(120) }) }, responses: { 200: ok('The entry.', skillDetailSchema), ...notFoundError, ...commonErrors } }),
    async (c) => {
      c.header('Cache-Control', PUBLIC_CACHE);
      return c.json(checked(skillDetailSchema, await skills.getSkill(db, c.req.valid('param').slug)), 200);
    },
  );

  app.openapi(
    createRoute({ method: 'get', path: '/public/sitemap.xml', tags: ['skills'], summary: 'The sitemap: the public pages and every published Skills Explorer entry (served at /sitemap.xml).', responses: { 200: { description: 'XML.', content: { 'application/xml': { schema: z.string() } } } } }),
    async (c) => {
      const origin = deps.appOrigin.replace(/\/$/, '');
      const entries = await skills.publishedSlugs(db);
      const urls = [`<url><loc>${escapeXml(`${origin}/skills`)}</loc></url>`, ...entries.map((e) => `<url><loc>${escapeXml(`${origin}/skills/${e.slug}`)}</loc><lastmod>${e.updatedAt.slice(0, 10)}</lastmod></url>`)];
      c.header('Cache-Control', PUBLIC_CACHE);
      return c.body(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`, 200, { 'Content-Type': 'application/xml; charset=utf-8' });
    },
  );

  return app;
}
