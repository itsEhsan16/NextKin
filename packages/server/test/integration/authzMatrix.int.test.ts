import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { totpAt } from '../../src/auth/totp';
import { openApiDocument } from '../../src/http/app';
import { randomUUID } from 'node:crypto';
import { SEED_TOTP_SECRET } from '../../src/seed/identities';
import { PERMISSIONS, type Permission } from '../../src/services/admin/permissions';
import { cookieFrom, DOMAIN, grantConsent, ORIGIN, PASSWORD, registered, startHarness, webLogin, type Harness } from './fixtures/authHarness';

/**
 * The authorization matrix (ImBackendImplementationPlan P4 exit; spec §16.6 grows it in P12).
 * Every operation in the OpenAPI document must be listed here with who may call it, so a new route
 * cannot ship without someone deciding its access. Each protected cell is probed with a real
 * session: anonymous gets 401, a role without access gets 403, a role with access gets neither.
 * Every signed-in probe uses a throwaway account, so the seeded demo accounts are never written.
 */
type Access = 'public' | 'user' | 'admin';
type Role = 'anonymous' | 'free' | 'pro' | 'support' | 'curator' | 'admin' | 'super_admin';

interface Entry {
  access: Access;
  /** Admin routes (P12-01): the permission they need; its roles are the only ones allowed through. */
  permission?: Permission;
  /** A body that passes validation, so the probe reaches the access check. */
  body?: unknown;
  /** Headers the route requires before it gets as far as the access check. */
  headers?: Record<string, string>;
  /** A query string the route validates before the access check. */
  query?: Record<string, string>;
}

const SETTINGS = (() => {
  const on = { inApp: true, email: true, push: true };
  return { channels: on, topics: { jobMatches: on, applicationUpdates: on, interviewReminders: on, resumeInsights: on, productUpdates: on, tips: on, accountSecurity: on } };
})();

const MATRIX: Record<string, Entry> = {
  'GET /api/v1/health': { access: 'public' },
  'GET /api/v1/health/deep': { access: 'public' },
  'GET /api/v1/health/features': { access: 'public' },
  'GET /api/v1/me/settings': { access: 'user' },
  'PATCH /api/v1/me/settings': { access: 'user', body: {} },
  'GET /api/v1/me/links': { access: 'user' },
  'POST /api/v1/me/links': { access: 'user', body: { kind: 'other', url: 'not a url' } },
  'DELETE /api/v1/me/links/{id}': { access: 'user' },
  'POST /api/v1/auth/signup': { access: 'public' },
  'POST /api/v1/auth/confirm': { access: 'public' },
  'POST /api/v1/auth/resend': { access: 'public' },
  'POST /api/v1/auth/login': { access: 'public' },
  'POST /api/v1/auth/admin/login': { access: 'public' },
  'GET /api/v1/auth/session': { access: 'user' },
  'POST /api/v1/auth/logout': { access: 'public' },
  'POST /api/v1/auth/logout-all': { access: 'user' },
  'POST /api/v1/auth/password/forgot': { access: 'public' },
  'POST /api/v1/auth/password/reset': { access: 'public' },
  'POST /api/v1/auth/password/change': { access: 'user', body: { current: 'not-the-current-password', next: 'another long passphrase' } },
  'GET /api/v1/auth/login/{provider}': { access: 'public' },
  'GET /api/v1/auth/link/{provider}': { access: 'user' },
  'POST /api/v1/auth/logout-others': { access: 'user' },
  'GET /api/v1/me': { access: 'user' },
  'PATCH /api/v1/me': { access: 'user', body: { firstName: 'Matrix', lastName: 'Probe' } },
  'POST /api/v1/me/email': { access: 'user', body: { email: 'matrix-probe@example.test' } },
  'POST /api/v1/me/email/confirm': { access: 'user', body: { code: '000000' } },
  'GET /api/v1/me/security': { access: 'user' },
  'GET /api/v1/me/dashboard': { access: 'user' },
  'GET /api/v1/me/activity': { access: 'user' },
  'GET /api/v1/me/connected-accounts': { access: 'user' },
  'DELETE /api/v1/me/connected-accounts/{provider}': { access: 'user' },
  'GET /api/v1/me/notification-prefs': { access: 'user' },
  'PUT /api/v1/me/notification-prefs': { access: 'user', body: { categories: { matches: true, closing: true, applications: true, ai: true, billing: false }, quietHours: true, weeklyDigest: true } },
  'GET /api/v1/me/notification-settings': { access: 'user' },
  'PUT /api/v1/me/notification-settings': { access: 'user', body: SETTINGS },
  'POST /api/v1/me/notification-settings/reset': { access: 'user' },
  'GET /api/v1/profile': { access: 'user' },
  'PATCH /api/v1/profile': { access: 'user', body: { headline: 'Probe' } },
  'PATCH /api/v1/profile/preferences': { access: 'user', body: { remote: 'any' } },
  'POST /api/v1/profile/experience': { access: 'user', body: { company: 'Matrix Co', title: 'Probe', startDate: '2020-01-01', current: true, skills: [] } },
  'PUT /api/v1/profile/experience/{id}': { access: 'user', body: { company: 'Matrix Co', title: 'Probe', startDate: '2020-01-01', current: true, skills: [] } },
  'DELETE /api/v1/profile/experience/{id}': { access: 'user' },
  'POST /api/v1/profile/education': { access: 'user', body: { institution: 'Probe U', degree: 'BSc', startDate: '2010-01-01', current: true } },
  'PUT /api/v1/profile/education/{id}': { access: 'user', body: { institution: 'Probe U', degree: 'BSc', startDate: '2010-01-01', current: true } },
  'DELETE /api/v1/profile/education/{id}': { access: 'user' },
  'POST /api/v1/profile/certifications': { access: 'user', body: { name: 'Probe', issuer: 'Probe Board' } },
  'PUT /api/v1/profile/certifications/{id}': { access: 'user', body: { name: 'Probe', issuer: 'Probe Board' } },
  'DELETE /api/v1/profile/certifications/{id}': { access: 'user' },
  'POST /api/v1/profile/links': { access: 'user', body: { label: 'Probe', url: 'https://probe.example' } },
  'PUT /api/v1/profile/links/{id}': { access: 'user', body: { label: 'Probe', url: 'https://probe.example' } },
  'DELETE /api/v1/profile/links/{id}': { access: 'user' },
  'PUT /api/v1/profile/skills': { access: 'user', body: { skills: [] } },
  'POST /api/v1/profile/draft': { access: 'user', body: {} },
  'POST /api/v1/profile/next-steps/{id}/complete': { access: 'user' },
  'POST /api/v1/uploads/presign': { access: 'user', body: { purpose: 'resume', fileName: 'cv.pdf', contentType: 'application/pdf', size: 1000 } },
  'POST /api/v1/uploads/{id}/confirm': { access: 'user' },
  'GET /api/v1/uploads/{id}': { access: 'user' },
  'POST /api/v1/resume-parse': { access: 'user', body: { uploadId: '00000000-0000-7000-8000-000000000000' } },
  'GET /api/v1/resume-parse/{id}': { access: 'user' },
  'POST /api/v1/resume-parse/{id}/apply': { access: 'user', body: {} },
  'POST /api/v1/resume-parse/{id}/resume': { access: 'user' },
  'PUT /api/v1/me/avatar': { access: 'user', body: { uploadId: '00000000-0000-7000-8000-000000000000' } },
  'POST /api/v1/teaser/presign': { access: 'public' },
  'POST /api/v1/teaser/{id}/confirm': { access: 'public' },
  'GET /api/v1/teaser/{id}': { access: 'public' },
  'POST /api/v1/teaser/{id}/claim': { access: 'user' },
  // P9: job descriptions and a finished run's document.
  'POST /api/v1/jd': { access: 'user', body: { source: 'paste', text: 'Backend engineer. Requirements: Go and PostgreSQL are required for this role.' } },
  'GET /api/v1/jd/{id}': { access: 'user' },
  'PATCH /api/v1/jd/{id}': { access: 'user', body: {} },
  'GET /api/v1/jd/{id}/match': { access: 'user' },
  'GET /api/v1/jd/{id}/comparison': { access: 'user', query: { resumeId: '00000000-0000-7000-8000-000000000000' } },
  'GET /api/v1/generations/{id}/result': { access: 'user' },
  'GET /api/v1/generations': { access: 'user' },
  'POST /api/v1/generations': { access: 'user', body: { kind: 'resume', title: 'Matrix probe' }, headers: { 'idempotency-key': 'matrix-probe-key-0001' } },
  'GET /api/v1/generations/active': { access: 'user' },
  'GET /api/v1/generations/{id}': { access: 'user' },
  'POST /api/v1/generations/{id}/retry': { access: 'user' },
  'POST /api/v1/generations/{id}/cancel': { access: 'user' },
  // P10: the library, the editor, exports and the server-only trash.
  'GET /api/v1/resumes': { access: 'user' },
  'POST /api/v1/resumes': { access: 'user', body: { title: 'Matrix probe', docType: 'resume' } },
  'GET /api/v1/resumes/{id}': { access: 'user' },
  'PATCH /api/v1/resumes/{id}': { access: 'user', body: { title: 'Probe' } },
  'DELETE /api/v1/resumes/{id}': { access: 'user' },
  'POST /api/v1/resumes/{id}/duplicate': { access: 'user' },
  'POST /api/v1/resumes/{id}/base': { access: 'user' },
  'POST /api/v1/resumes/{id}/confirm-accuracy': { access: 'user' },
  'GET /api/v1/resumes/{id}/score': { access: 'user' },
  'GET /api/v1/resumes/{id}/versions': { access: 'user' },
  'POST /api/v1/resumes/{id}/restore': { access: 'user', body: { versionId: '00000000-0000-7000-8000-000000000002' } },
  'GET /api/v1/resumes/{id}/content': { access: 'user' },
  'PUT /api/v1/resumes/{id}/sections/{section}': { access: 'user', body: { value: 'A probe summary.' } },
  'PATCH /api/v1/resumes/{id}/letter': { access: 'user', body: { greeting: 'Hello' } },
  'POST /api/v1/resumes/{id}/sections/{section}/regenerate': { access: 'user', headers: { 'idempotency-key': 'matrix-probe-key-0002' } },
  'GET /api/v1/resumes/{id}/regenerations/{runId}': { access: 'user' },
  'POST /api/v1/resumes/{id}/fixes': { access: 'user', body: { itemId: 'probe' } },
  'POST /api/v1/resumes/{id}/zero-check': { access: 'user', body: { kind: 'skill', skill: 'Probe', remove: true } },
  'POST /api/v1/resumes/{id}/exports': { access: 'user', body: { format: 'pdf' } },
  'GET /api/v1/exports/{id}': { access: 'user' },
  'GET /api/v1/resumes/{id}/preview': { access: 'user' },
  'POST /api/v1/resumes/{id}/fit': { access: 'user' },
  'GET /api/v1/resumes/{id}/document': { access: 'user' },
  'PUT /api/v1/resumes/{id}/document': {
    access: 'user',
    body: {
      document: {
        header: { name: 'Probe', headline: '', items: [] },
        summary: '',
        skills: { groups: [], loose: [] },
        experience: [],
        projects: [],
        education: [],
        certifications: [],
        custom: [],
        order: [],
        headings: {},
        template: 'jake',
      },
      baseRevision: 'probe',
    },
  },
  'GET /api/v1/resumes/{id}/fit/{runId}': { access: 'user' },
  'GET /api/v1/trash': { access: 'user' },
  'POST /api/v1/resumes/{id}/trash': { access: 'user' },
  'POST /api/v1/resumes/{id}/untrash': { access: 'user' },
  // P11: job search and saved jobs.
  'GET /api/v1/jobs/search': { access: 'user' },
  'GET /api/v1/jobs/count': { access: 'user' },
  'GET /api/v1/jobs/picks': { access: 'user' },
  'GET /api/v1/jobs/todays-picks': { access: 'user' },
  'GET /api/v1/jobs/saved': { access: 'user' },
  'POST /api/v1/jd/{id}/save': { access: 'user' },
  'GET /api/v1/notifications': { access: 'user' },
  'POST /api/v1/notifications/read-all': { access: 'user' },
  'POST /api/v1/notifications/{id}/read': { access: 'user' },
  'DELETE /api/v1/notifications/{id}': { access: 'user' },
  'GET /api/v1/applications': { access: 'user' },
  'POST /api/v1/applications': { access: 'user', body: { jobId: 'matrix-probe' } },
  'PATCH /api/v1/applications/{id}': { access: 'user', body: { status: 'interview' } },
  'GET /api/v1/applications/asks': { access: 'user' },
  'POST /api/v1/applications/asks': { access: 'user', body: { resumeId: 'matrix-probe' } },
  'POST /api/v1/applications/asks/{id}/answer': { access: 'user', body: { answer: 'no' } },
  'POST /api/v1/jobs/saved': { access: 'user', body: { jobId: '00000000-0000-8000-8000-000000000003' } },
  'DELETE /api/v1/jobs/saved/{id}': { access: 'user' },
  'PATCH /api/v1/jobs/saved/{id}': { access: 'user', body: { notes: 'probe' } },
  'GET /api/v1/jobs/by-company': { access: 'user' },
  'GET /api/v1/jobs/{id}': { access: 'user' },
  'GET /api/v1/jobs/{id}/similar': { access: 'user' },
  // P11: interview practice sets.
  'GET /api/v1/interview/question-sets': { access: 'user' },
  'GET /api/v1/interview/question-sets/by-generation/{id}': { access: 'user' },
  'GET /api/v1/interview/question-sets/{id}': { access: 'user' },
  'PUT /api/v1/interview/question-sets/{id}/questions/{questionId}/mark': { access: 'user', body: { mark: 'confident' } },
  'POST /api/v1/interview/question-sets/{id}/reset': { access: 'user' },
  'DELETE /api/v1/interview/question-sets/{id}': { access: 'user' },
  // P12: billing. Plans, webhooks and the fake gateway's page are public (the webhook is signed).
  'GET /api/v1/billing/plans': { access: 'public' },
  'GET /api/v1/me/subscription': { access: 'user' },
  'POST /api/v1/billing/checkout': { access: 'user', body: { planId: 'pro_monthly', country: 'US' } },
  'GET /api/v1/billing': { access: 'user' },
  'PATCH /api/v1/billing/settings': { access: 'user', body: { autoRenew: true } },
  'POST /api/v1/billing/cancel': { access: 'user' },
  'POST /api/v1/billing/pause': { access: 'user', body: { months: 1 } },
  'POST /api/v1/billing/resume': { access: 'user' },
  'POST /api/v1/billing/withdraw': { access: 'user' },
  'POST /api/v1/billing/webhooks/{provider}': { access: 'public' },
  'GET /api/v1/billing/fake-checkout/{token}': { access: 'public' },
  'POST /api/v1/billing/fake-checkout/{token}/complete': { access: 'public' },
  // P12: the admin API (§7.17, §16.6). Probed as every role; each route's permission decides.
  'GET /api/v1/admin/me': { access: 'admin' },
  'GET /api/v1/admin/users': { access: 'admin', permission: 'users.read' },
  'GET /api/v1/admin/users/{id}': { access: 'admin', permission: 'users.read' },
  'POST /api/v1/admin/users/{id}/suspend': { access: 'admin', permission: 'users.manage', body: { reason: 'abuse' } },
  'POST /api/v1/admin/users/{id}/reactivate': { access: 'admin', permission: 'users.manage', body: { reason: 'user_request' } },
  'POST /api/v1/admin/users/{id}/password-reset': { access: 'admin', permission: 'users.manage' },
  'POST /api/v1/admin/users/{id}/delete': { access: 'admin', permission: 'users.manage', body: { reason: 'matrix probe' } },
  'POST /api/v1/admin/users/{id}/comp': { access: 'admin', permission: 'users.manage', body: { months: 1, reason: 'matrix probe' } },
  'GET /api/v1/admin/users/{id}/resumes/{resumeId}': { access: 'admin', permission: 'users.content' },
  'PUT /api/v1/admin/staff/{id}/roles': { access: 'admin', permission: 'roles.assign', body: { groups: ['support'] } },
  'GET /api/v1/admin/audit': { access: 'admin', permission: 'audit.read' },
  'GET /api/v1/admin/audit/export': { access: 'admin', permission: 'audit.read' },
  'GET /api/v1/admin/prompts': { access: 'admin', permission: 'content.manage' },
  'POST /api/v1/admin/prompts/{name}/versions': { access: 'admin', permission: 'content.manage', body: { system: ['probe'] } },
  'POST /api/v1/admin/prompts/versions/{id}/stage': { access: 'admin', permission: 'content.manage' },
  'POST /api/v1/admin/prompts/versions/{id}/evaluate': { access: 'admin', permission: 'content.manage' },
  'GET /api/v1/admin/prompts/evaluations/{id}': { access: 'admin', permission: 'content.manage' },
  'POST /api/v1/admin/prompts/versions/{id}/activate': { access: 'admin', permission: 'content.manage' },
  'GET /api/v1/admin/technologies': { access: 'admin', permission: 'content.manage' },
  'POST /api/v1/admin/technologies': { access: 'admin', permission: 'content.manage', body: { name: 'Kubernetes', slug: 'kubernetes', category: 'tool' } },
  'PATCH /api/v1/admin/technologies/{id}': { access: 'admin', permission: 'content.manage', body: {} },
  'POST /api/v1/admin/technologies/{id}/review': { access: 'admin', permission: 'content.manage', body: { decision: 'approve' } },
  'POST /api/v1/admin/technologies/import': { access: 'admin', permission: 'content.manage', body: { format: 'json', content: '[]' } },
  'GET /api/v1/admin/kb/queue': { access: 'admin', permission: 'content.manage' },
  'POST /api/v1/admin/kb/datasets': { access: 'admin', permission: 'content.manage', body: { notes: 'matrix probe' } },
  'GET /api/v1/admin/templates': { access: 'admin', permission: 'content.manage' },
  'POST /api/v1/admin/templates/{slug}/status': { access: 'admin', permission: 'content.manage', body: { status: 'draft' } },
  'GET /api/v1/admin/plans': { access: 'admin', permission: 'plans.manage' },
  'PUT /api/v1/admin/plans/{id}/prices': { access: 'admin', permission: 'plans.manage', body: { USD: 1900, EUR: 1900, AUD: 2900 } },
  'PATCH /api/v1/admin/plans/{id}/quotas': { access: 'admin', permission: 'plans.manage', body: {} },
  'GET /api/v1/admin/providers': { access: 'admin', permission: 'providers.manage' },
  'PATCH /api/v1/admin/providers/{provider}': { access: 'admin', permission: 'providers.manage', body: {} },
  'PUT /api/v1/admin/providers/{provider}/key': { access: 'admin', permission: 'providers.keys', body: { key: 'probe-key-not-real' } },
  'GET /api/v1/admin/analytics': { access: 'admin', permission: 'analytics.read' },
  'GET /api/v1/admin/rubric': { access: 'admin', permission: 'analytics.read' },
  // P12: support.
  'GET /api/v1/support/faq': { access: 'public' },
  'GET /api/v1/support/legal/{key}': { access: 'public' },
  'POST /api/v1/support/tickets': { access: 'user', body: { topic: 'question', message: 'Matrix probe' } },
  // P12: consent and data rights.
  'GET /api/v1/me/consents/ai': { access: 'user' },
  'POST /api/v1/me/consents/ai': { access: 'user', body: { version: 'providers-v1' } },
  'DELETE /api/v1/me/consents/ai': { access: 'user' },
  'GET /api/v1/me/data-export': { access: 'user' },
  'POST /api/v1/me/data-export': { access: 'user' },
  'DELETE /api/v1/me': { access: 'user' },
  // P11: the Skills Explorer's public reads.
  'GET /api/v1/public/skills': { access: 'public' },
  'GET /api/v1/public/skills/trending': { access: 'public' },
  'GET /api/v1/public/skills/{slug}': { access: 'public' },
  'GET /api/v1/public/sitemap.xml': { access: 'public' },
  // P11: shareable ATS reports.
  'POST /api/v1/resumes/{id}/share': { access: 'user' },
  'GET /api/v1/shared-reports': { access: 'user' },
  'DELETE /api/v1/shared-reports/{id}': { access: 'user' },
  'GET /api/v1/public/shared-reports/{token}': { access: 'public' },
  // P11: the assistant.
  'GET /api/v1/assistant/sessions': { access: 'user' },
  'GET /api/v1/assistant/sessions/current': { access: 'user' },
  // §129: the "Add the result" line drafted for a figure.
  'POST /api/v1/tailor/figure-draft': { access: 'user', body: { resumeId: 'probe', roleId: 'probe', line: 0 } },
  'POST /api/v1/assistant/sessions': { access: 'user' },
  'POST /api/v1/assistant/sessions/current/clear': { access: 'user' },
  'POST /api/v1/assistant/sessions/{id}/open': { access: 'user' },
  'POST /api/v1/assistant/messages': { access: 'user', body: { text: 'Tell me a joke.' } },
  'GET /api/v1/assistant/messages/{id}': { access: 'user' },
  'POST /api/v1/auth/token/exchange': { access: 'public' },
  'POST /api/v1/auth/token/refresh': { access: 'public' },
};

const ALLOWED: Record<Access, Role[]> = {
  public: ['anonymous', 'free', 'pro', 'admin'],
  user: ['free', 'pro', 'admin'],
  admin: ['support', 'curator', 'admin', 'super_admin'],
};
/** §16.6: admin routes are probed with every role; user routes with the four that differ there. */
const ROLES_FOR: Record<Access, Role[]> = {
  public: [],
  user: ['anonymous', 'free', 'pro', 'admin'],
  admin: ['anonymous', 'free', 'pro', 'support', 'curator', 'admin', 'super_admin'],
};
const allowedFor = (entry: Entry): Role[] => (entry.permission ? [...PERMISSIONS[entry.permission]] : ALLOWED[entry.access]);
const GROUPS: Partial<Record<Role, string[]>> = { support: ['support'], curator: ['curator'], admin: ['admin'], super_admin: ['admin', 'super_admin'] };

let h: Harness;
beforeAll(async () => {
  h = await startHarness({ files: true });
});
afterAll(async () => {
  await h.close();
});

/**
 * A fresh session per probe, on a throwaway account, so probing logout cannot spoil the next cell
 * and the writes the probes make never touch the seeded demo accounts. Free and Pro are the same
 * to every route today; entitlements (P12) give them different accounts and different answers.
 */
async function sessionFor(role: Role): Promise<string | null> {
  if (role === 'anonymous') return null;
  const groups = GROUPS[role];
  if (groups) {
    const email = `matrix-${role}-${randomUUID().slice(0, 8)}@${DOMAIN}`;
    await h.stack.local!.upsertAccount({ sub: `local|matrix-${randomUUID()}`, pool: 'admins', email, password: PASSWORD, groups, totpSecret: SEED_TOTP_SECRET });
    const res = await h.app.request('/api/v1/auth/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ email, password: PASSWORD, totp: totpAt(SEED_TOTP_SECRET, Date.now()) }),
    });
    // Consented like the user probes (P12-12), so a 403 here can only mean forbidden.
    await grantConsent(h.db, email);
    return cookieFrom(res);
  }
  return webLogin(h, await registered(h));
}

function operations(): string[] {
  const doc = openApiDocument(h.app) as unknown as { paths: Record<string, Record<string, unknown>> };
  return Object.entries(doc.paths).flatMap(([path, ops]) => Object.keys(ops).map((method) => `${method.toUpperCase()} ${path}`));
}

it('every operation in the API has an entry in the matrix, and no entry is stale', () => {
  const ops = operations().sort();
  expect(ops.filter((op) => !MATRIX[op])).toEqual([]);
  expect(Object.keys(MATRIX).filter((op) => !ops.includes(op))).toEqual([]);
});

describe.each(Object.entries(MATRIX).filter(([, e]) => e.access !== 'public'))('%s', (operation, entry) => {
  const [method, template] = operation.split(' ') as [string, string];
  const path = template
    .replace('{id}', '00000000-0000-7000-8000-000000000000')
    .replace('{runId}', '00000000-0000-7000-8000-000000000001')
    .replace('{resumeId}', '00000000-0000-7000-8000-000000000002')
    .replace('{section}', 'summary')
    .replace('{provider}', 'google')
    .replace('{name}', 'no-such-template')
    .replace('{slug}', 'no-such-template');

  it.each(ROLES_FOR[entry.access])('as %s', async (role) => {
    const allowed = allowedFor(entry).includes(role);
    const cookie = await sessionFor(role);
    const headers: Record<string, string> = cookie ? { cookie, origin: ORIGIN } : {};
    if (entry.body !== undefined) headers['content-type'] = 'application/json';
    Object.assign(headers, entry.headers);
    const url = entry.query ? `${path}?${new URLSearchParams(entry.query).toString()}` : path;
    const res = await h.app.request(url, { method, headers, body: entry.body === undefined ? undefined : JSON.stringify(entry.body) });
    if (role === 'anonymous') expect(res.status).toBe(401);
    else if (!allowed) expect(res.status).toBe(403);
    else expect([401, 403]).not.toContain(res.status);
  });
});
