import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import type { Context } from 'hono';

import type { IdentityProvider } from '../../auth/ports/identity';
import type { SessionStore } from '../../auth/sessions';
import type { Database } from '../../db/database';
import type { Logger } from '../../observability/logger';
import type { PaymentProvider } from '../../payments/types';
import type { SecretsPort } from '../../secrets/secrets';
import { searchAudit, toCsv } from '../../services/admin/audit';
import * as catalog from '../../services/admin/catalog';
import { PERMISSIONS, levelOf, requireStaff, type Permission } from '../../services/admin/permissions';
import * as prompts from '../../services/admin/prompts';
import * as kb from '../../services/admin/technologies';
import * as users from '../../services/admin/users';
import type { ApiEnv } from '../env';
import { errors } from '../errors';
import { commonErrors, notFoundError } from './common';

/**
 * The admin API (spec §7.17; ImBackendImplementationPlan P12-01…P12-05). Staff sign in through the
 * admin pool with TOTP (P4). Every route names the permission it needs (`services/admin/
 * permissions.ts`), checked on the server; the authorization matrix probes each one with every
 * role. Every change is audited. The admin UI has its own plan (rule 7); these responses are its
 * contract and stay loosely typed until that plan pins them.
 */

export interface AdminRouteDeps {
  db: Database;
  log: Logger;
  provider: PaymentProvider;
  secrets: SecretsPort;
  idp?: IdentityProvider;
  sessions?: SessionStore;
}

const ok = (description: string) => ({ description, content: { 'application/json': { schema: z.unknown() } } });
const json = <S extends z.ZodType>(schema: S) => ({ required: true, content: { 'application/json': { schema } } });
const errs = { 401: { description: 'Not signed in.' }, 403: { description: 'Not permitted for this role.' }, ...notFoundError, ...commonErrors };
const id = z.object({ id: z.string().max(100) });
const meta = (c: Context<ApiEnv>) => ({ ip: c.get('clientIp') ?? null, requestId: c.get('requestId') ?? null });

/** Builds one admin route: its permission is checked before anything else runs. */
function admin<P extends Permission>(permission: P) {
  return { permission, describe: (s: string) => `${s} (needs ${permission}: ${PERMISSIONS[permission].join(', ')})` };
}

export function adminRoutes(deps: AdminRouteDeps): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();
  const { db } = deps;
  // Staff only, before any request is validated: anonymous is 401 and a user session 403 on every admin route.
  app.use('/admin/*', async (c, next) => {
    const auth = c.get('auth');
    if (!auth) throw errors.unauthenticated();
    if (!levelOf(auth)) throw errors.forbidden();
    await next();
  });
  const userDeps = { db, log: deps.log, provider: deps.provider, ...(deps.idp ? { idp: deps.idp } : {}), ...(deps.sessions ? { sessions: deps.sessions } : {}) };

  app.openapi(createRoute({ method: 'get', path: '/admin/me', tags: ['admin'], summary: 'The staff member’s role and permissions.', responses: { 200: ok('Role.'), ...errs } }), async (c) => {
    const auth = c.get('auth');
    if (!auth) throw errors.unauthenticated();
    const level = levelOf(auth);
    if (!level) throw errors.forbidden();
    return c.json({ role: level, permissions: (Object.keys(PERMISSIONS) as Permission[]).filter((p) => (PERMISSIONS[p] as readonly string[]).includes(level)) }, 200);
  });

  // --- Users ---------------------------------------------------------------------------------
  const read = admin('users.read');
  app.openapi(createRoute({ method: 'get', path: '/admin/users', tags: ['admin'], summary: read.describe('Search users by email, name or id'), request: { query: z.object({ q: z.string().max(120).optional() }) }, responses: { 200: ok('Users.'), ...errs } }), async (c) =>
    c.json({ data: await users.searchUsers(db, requireStaff(c, 'users.read'), c.req.valid('query').q ?? '') }, 200),
  );
  app.openapi(createRoute({ method: 'get', path: '/admin/users/{id}', tags: ['admin'], summary: read.describe('A user: status, tier, usage, security events'), request: { params: id }, responses: { 200: ok('The user.'), ...errs } }), async (c) =>
    c.json(await users.inspectUser(db, requireStaff(c, 'users.read'), c.req.valid('param').id), 200),
  );

  const manage = admin('users.manage');
  const statusBody = z.object({ reason: z.enum(users.SUSPEND_REASONS), note: z.string().max(500).optional() }).strict();
  app.openapi(createRoute({ method: 'post', path: '/admin/users/{id}/suspend', tags: ['admin'], summary: manage.describe('Suspend with a reason code; every session ends'), request: { params: id, body: json(statusBody) }, responses: { 200: ok('Status.'), ...errs } }), async (c) => {
    const body = c.req.valid('json');
    return c.json(await users.setUserStatus(userDeps, requireStaff(c, 'users.manage'), c.req.valid('param').id, 'suspended', body.reason, body.note, meta(c)), 200);
  });
  app.openapi(createRoute({ method: 'post', path: '/admin/users/{id}/reactivate', tags: ['admin'], summary: manage.describe('Reactivate with a reason code'), request: { params: id, body: json(statusBody) }, responses: { 200: ok('Status.'), ...errs } }), async (c) => {
    const body = c.req.valid('json');
    return c.json(await users.setUserStatus(userDeps, requireStaff(c, 'users.manage'), c.req.valid('param').id, 'active', body.reason, body.note, meta(c)), 200);
  });
  app.openapi(createRoute({ method: 'post', path: '/admin/users/{id}/password-reset', tags: ['admin'], summary: manage.describe('Send the user a password-reset code (admins never see a password)'), request: { params: id }, responses: { 204: { description: 'Sent.' }, ...errs } }), async (c) => {
    await users.resetPassword(userDeps, requireStaff(c, 'users.manage'), c.req.valid('param').id, meta(c));
    return c.body(null, 204);
  });
  app.openapi(
    createRoute({ method: 'post', path: '/admin/users/{id}/delete', tags: ['admin'], summary: manage.describe('Process a deletion request (§8.5)'), request: { params: id, body: json(z.object({ reason: z.string().min(3).max(500) }).strict()) }, responses: { 204: { description: 'Deleted.' }, ...errs } }),
    async (c) => {
      await users.processDeletion(userDeps, requireStaff(c, 'users.manage'), c.req.valid('param').id, c.req.valid('json').reason, meta(c));
      return c.body(null, 204);
    },
  );
  app.openapi(
    createRoute({ method: 'post', path: '/admin/users/{id}/comp', tags: ['admin'], summary: manage.describe('Comped Pro for 1–12 months'), request: { params: id, body: json(z.object({ months: z.number().int().min(1).max(12), reason: z.string().min(3).max(500) }).strict()) }, responses: { 200: ok('Until.'), ...errs } }),
    async (c) => {
      const body = c.req.valid('json');
      return c.json(await users.grantComp(db, requireStaff(c, 'users.manage'), c.req.valid('param').id, body.months, body.reason, meta(c)), 200);
    },
  );
  const content = admin('users.content');
  app.openapi(
    createRoute({ method: 'get', path: '/admin/users/{id}/resumes/{resumeId}', tags: ['admin'], summary: content.describe('One resume’s content: exceptional, needs a reason, audited'), request: { params: z.object({ id: z.string().max(100), resumeId: z.string().max(100) }), query: z.object({ reason: z.string().max(500).optional() }) }, responses: { 200: ok('The content.'), ...errs } }),
    async (c) => {
      const p = c.req.valid('param');
      return c.json(await users.readUserResume(db, requireStaff(c, 'users.content'), p.id, p.resumeId, c.req.valid('query').reason ?? '', meta(c)), 200);
    },
  );
  const roles = admin('roles.assign');
  app.openapi(
    createRoute({ method: 'put', path: '/admin/staff/{id}/roles', tags: ['admin'], summary: roles.describe('Set a staff account’s roles'), request: { params: id, body: json(z.object({ groups: z.array(z.string().max(30)).min(1).max(4) }).strict()) }, responses: { 200: ok('Roles.'), ...errs } }),
    async (c) => c.json(await users.setRoles(userDeps, requireStaff(c, 'roles.assign'), c.req.valid('param').id, c.req.valid('json').groups, meta(c)), 200),
  );

  // --- Audit ---------------------------------------------------------------------------------
  const audit = admin('audit.read');
  const auditQuery = z.object({ actor: z.string().max(100).optional(), action: z.string().max(100).optional(), targetType: z.string().max(60).optional(), targetId: z.string().max(100).optional(), from: z.iso.datetime().optional(), to: z.iso.datetime().optional(), before: z.coerce.number().int().optional(), limit: z.coerce.number().int().min(1).max(500).optional() });
  app.openapi(createRoute({ method: 'get', path: '/admin/audit', tags: ['admin'], summary: audit.describe('Search the audit log, newest first'), request: { query: auditQuery }, responses: { 200: ok('Rows.'), ...errs } }), async (c) =>
    c.json({ data: await searchAudit(db, requireStaff(c, 'audit.read'), c.req.valid('query')) }, 200),
  );
  app.openapi(createRoute({ method: 'get', path: '/admin/audit/export', tags: ['admin'], summary: audit.describe('Export the audit log as CSV'), request: { query: auditQuery }, responses: { 200: { description: 'CSV.', content: { 'text/csv': { schema: z.string() } } }, ...errs } }), async (c) => {
    const rows = await searchAudit(db, requireStaff(c, 'audit.read'), { ...c.req.valid('query'), limit: 500 });
    return c.body(toCsv(rows), 200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="nextkin-audit.csv"' });
  });

  // --- Prompts -------------------------------------------------------------------------------
  const cm = admin('content.manage');
  app.openapi(createRoute({ method: 'get', path: '/admin/prompts', tags: ['admin'], summary: cm.describe('Prompt templates and their versions'), responses: { 200: ok('Prompts.'), ...errs } }), async (c) =>
    c.json({ data: await prompts.listPrompts(db, requireStaff(c, 'content.manage')) }, 200),
  );
  app.openapi(
    createRoute({ method: 'post', path: '/admin/prompts/{name}/versions', tags: ['admin'], summary: cm.describe('Draft a new version'), request: { params: z.object({ name: z.string().max(80) }), body: json(z.object({ system: z.array(z.string().min(1).max(4000)).min(1).max(20) }).strict()) }, responses: { 201: ok('The draft.'), ...errs } }),
    async (c) => c.json(await prompts.draftPrompt(db, requireStaff(c, 'content.manage'), c.req.valid('param').name, c.req.valid('json'), meta(c)), 201),
  );
  app.openapi(createRoute({ method: 'post', path: '/admin/prompts/versions/{id}/stage', tags: ['admin'], summary: cm.describe('Stage a draft'), request: { params: id }, responses: { 204: { description: 'Staged.' }, ...errs } }), async (c) => {
    await prompts.stagePrompt(db, requireStaff(c, 'content.manage'), c.req.valid('param').id, meta(c));
    return c.body(null, 204);
  });
  app.openapi(createRoute({ method: 'post', path: '/admin/prompts/versions/{id}/evaluate', tags: ['admin'], summary: cm.describe('Evaluate a version on the worker (billed as eval)'), request: { params: id }, responses: { 202: ok('The evaluation.'), ...errs } }), async (c) =>
    c.json(await prompts.evaluatePrompt(db, requireStaff(c, 'content.manage'), c.req.valid('param').id, meta(c)), 202),
  );
  app.openapi(createRoute({ method: 'get', path: '/admin/prompts/evaluations/{id}', tags: ['admin'], summary: cm.describe('An evaluation’s state and report'), request: { params: id }, responses: { 200: ok('The evaluation.'), ...errs } }), async (c) =>
    c.json(await prompts.getEvaluation(db, requireStaff(c, 'content.manage'), c.req.valid('param').id), 200),
  );
  app.openapi(createRoute({ method: 'post', path: '/admin/prompts/versions/{id}/activate', tags: ['admin'], summary: cm.describe('Publish a staged version (needs a passing evaluation) or roll back to an earlier one'), request: { params: id }, responses: { 204: { description: 'Active.' }, 409: { description: 'No passing evaluation (CONFLICT).' }, ...errs } }), async (c) => {
    await prompts.activatePrompt(db, requireStaff(c, 'content.manage'), c.req.valid('param').id, meta(c));
    return c.body(null, 204);
  });

  // --- The Technology KB -----------------------------------------------------------------------
  app.openapi(createRoute({ method: 'get', path: '/admin/technologies', tags: ['admin'], summary: cm.describe('KB entries'), request: { query: z.object({ status: z.enum(['llm_seeded', 'admin_reviewed', 'published']).optional(), q: z.string().max(80).optional() }) }, responses: { 200: ok('Entries.'), ...errs } }), async (c) =>
    c.json({ data: await kb.listTechnologies(db, requireStaff(c, 'content.manage'), c.req.valid('query')) }, 200),
  );
  app.openapi(createRoute({ method: 'post', path: '/admin/technologies', tags: ['admin'], summary: cm.describe('Create an entry'), request: { body: json(z.record(z.string(), z.unknown())) }, responses: { 201: ok('The entry.'), ...errs } }), async (c) =>
    c.json(await kb.createTechnology(db, requireStaff(c, 'content.manage'), c.req.valid('json') as kb.TechnologyInput, meta(c)), 201),
  );
  app.openapi(createRoute({ method: 'patch', path: '/admin/technologies/{id}', tags: ['admin'], summary: cm.describe('Edit an entry (audited as a diff)'), request: { params: id, body: json(z.record(z.string(), z.unknown())) }, responses: { 200: ok('The entry.'), ...errs } }), async (c) =>
    c.json(await kb.updateTechnology(db, requireStaff(c, 'content.manage'), c.req.valid('param').id, c.req.valid('json') as Partial<kb.TechnologyInput>, meta(c)), 200),
  );
  app.openapi(
    createRoute({ method: 'post', path: '/admin/technologies/{id}/review', tags: ['admin'], summary: cm.describe('Approve, publish or reject an entry'), request: { params: id, body: json(z.object({ decision: z.enum(['approve', 'publish', 'reject']) }).strict()) }, responses: { 200: ok('The entry, or null when rejected.'), ...errs } }),
    async (c) => c.json(await kb.reviewTechnology(db, requireStaff(c, 'content.manage'), c.req.valid('param').id, c.req.valid('json').decision, meta(c)), 200),
  );
  app.openapi(
    createRoute({ method: 'post', path: '/admin/technologies/import', tags: ['admin'], summary: cm.describe('Bulk import CSV or JSON: valid rows import, invalid rows are listed'), request: { body: json(z.object({ format: z.enum(['csv', 'json']), content: z.string().max(2_000_000) }).strict()) }, responses: { 200: ok('Imported and failed rows.'), ...errs } }),
    async (c) => c.json(await kb.importTechnologies(db, requireStaff(c, 'content.manage'), c.req.valid('json'), meta(c)), 200),
  );
  app.openapi(createRoute({ method: 'get', path: '/admin/kb/queue', tags: ['admin'], summary: cm.describe('The review queue and users’ reports'), responses: { 200: ok('The queue.'), ...errs } }), async (c) =>
    c.json(await kb.reviewQueue(db, requireStaff(c, 'content.manage')), 200),
  );
  app.openapi(createRoute({ method: 'post', path: '/admin/kb/datasets', tags: ['admin'], summary: cm.describe('Close a dataset version'), request: { body: json(z.object({ notes: z.string().min(1).max(500) }).strict()) }, responses: { 201: ok('The version.'), ...errs } }), async (c) =>
    c.json(await kb.publishDataset(db, requireStaff(c, 'content.manage'), c.req.valid('json').notes, meta(c)), 201),
  );

  // --- Templates -------------------------------------------------------------------------------
  app.openapi(createRoute({ method: 'get', path: '/admin/templates', tags: ['admin'], summary: cm.describe('Resume templates'), responses: { 200: ok('Templates.'), ...errs } }), async (c) =>
    c.json({ data: await catalog.listTemplates(db, requireStaff(c, 'content.manage')) }, 200),
  );
  app.openapi(
    createRoute({ method: 'post', path: '/admin/templates/{slug}/status', tags: ['admin'], summary: cm.describe('Publish (certified only, Q-06), unpublish or archive'), request: { params: z.object({ slug: z.string().max(120) }), body: json(z.object({ status: z.enum(['published', 'draft', 'archived']) }).strict()) }, responses: { 200: ok('The status.'), 409: { description: 'Not certified (CONFLICT).' }, ...errs } }),
    async (c) => c.json(await catalog.setTemplateStatus(db, requireStaff(c, 'content.manage'), c.req.valid('param').slug, c.req.valid('json').status, meta(c)), 200),
  );

  // --- Plans -----------------------------------------------------------------------------------
  const plans = admin('plans.manage');
  app.openapi(createRoute({ method: 'get', path: '/admin/plans', tags: ['admin'], summary: plans.describe('Plans, prices and quotas'), responses: { 200: ok('Plans.'), ...errs } }), async (c) =>
    c.json({ data: await catalog.listPlans(db, requireStaff(c, 'plans.manage')) }, 200),
  );
  app.openapi(
    createRoute({ method: 'put', path: '/admin/plans/{id}/prices', tags: ['admin'], summary: plans.describe('A new price-book version (minor units)'), request: { params: id, body: json(z.object({ USD: z.number().int().min(0), EUR: z.number().int().min(0), AUD: z.number().int().min(0) }).strict()) }, responses: { 200: ok('The prices.'), ...errs } }),
    async (c) => c.json(await catalog.setPlanPrices(db, requireStaff(c, 'plans.manage'), c.req.valid('param').id, c.req.valid('json'), meta(c)), 200),
  );
  app.openapi(
    createRoute({ method: 'patch', path: '/admin/plans/{id}/quotas', tags: ['admin'], summary: plans.describe('Per-plan quotas (null is unlimited)'), request: { params: id, body: json(z.record(z.string(), z.number().int().min(0).nullable())) }, responses: { 200: ok('The quotas.'), ...errs } }),
    async (c) => c.json(await catalog.setPlanQuotas(db, requireStaff(c, 'plans.manage'), c.req.valid('param').id, c.req.valid('json'), meta(c)), 200),
  );

  // --- Job providers ---------------------------------------------------------------------------
  const prov = admin('providers.manage');
  app.openapi(createRoute({ method: 'get', path: '/admin/providers', tags: ['admin'], summary: prov.describe('Job providers; whether a key is set, never the key'), responses: { 200: ok('Providers.'), ...errs } }), async (c) =>
    c.json({ data: await catalog.listProviders(db, requireStaff(c, 'providers.manage')) }, 200),
  );
  app.openapi(
    createRoute({ method: 'patch', path: '/admin/providers/{provider}', tags: ['admin'], summary: prov.describe('Enable, order or cap a provider; takes effect without a deployment'), request: { params: z.object({ provider: z.string().max(40) }), body: json(z.object({ enabled: z.boolean().optional(), priority: z.number().int().min(0).max(1000).optional(), dailyCalls: z.number().int().min(0).nullable().optional() }).strict()) }, responses: { 200: ok('The provider.'), ...errs } }),
    async (c) => c.json(await catalog.updateProvider(db, requireStaff(c, 'providers.manage'), c.req.valid('param').provider, c.req.valid('json'), meta(c)), 200),
  );
  const keys = admin('providers.keys');
  app.openapi(
    createRoute({ method: 'put', path: '/admin/providers/{provider}/key', tags: ['admin'], summary: keys.describe('Set a provider key: write-only, never displayed again'), request: { params: z.object({ provider: z.string().max(40) }), body: json(z.object({ key: z.string().min(8).max(500) }).strict()) }, responses: { 200: ok('Whether a key is set.'), ...errs } }),
    async (c) => c.json(await catalog.setProviderKey(db, deps.secrets, requireStaff(c, 'providers.keys'), c.req.valid('param').provider, c.req.valid('json').key, meta(c)), 200),
  );

  // --- Analytics and the rubric ------------------------------------------------------------------
  const an = admin('analytics.read');
  app.openapi(createRoute({ method: 'get', path: '/admin/analytics', tags: ['admin'], summary: an.describe('Aggregates only: users, runs, scores, AI spend, subscriptions, quota use'), responses: { 200: ok('Aggregates.'), ...errs } }), async (c) => {
    requireStaff(c, 'analytics.read');
    return c.json(await catalog.analytics(db), 200);
  });
  app.openapi(createRoute({ method: 'get', path: '/admin/rubric', tags: ['admin'], summary: an.describe('Rubric versions with their rationale and evidence (G15)'), responses: { 200: ok('Versions.'), ...errs } }), async (c) =>
    c.json({ data: await catalog.listRubric(db, requireStaff(c, 'analytics.read')) }, 200),
  );

  return app;
}
