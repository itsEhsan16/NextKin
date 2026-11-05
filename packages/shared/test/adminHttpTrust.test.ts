import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_AUDIT_FILTERS, type AuditFilters } from '../src/models/adminTrust';
import { createHttpAdminTrustRepo } from '../src/repos/http/adminTrustRepo';
import { createHttpClient } from '../src/repos/http/client';

/**
 * The Trust & safety HTTP repository against the server's real contract (`packages/server/src/
 * http/routes/admin.ts` and `routes/auth.ts`). Each fake response copies what the named service
 * function returns.
 */

const NOW = new Date('2026-11-05T12:00:00.000Z');
const DAY = 86_400_000;

type Call = { method: string; url: string; query: URLSearchParams; body: unknown };

const envelope = (code: string, message: string, details: unknown = null) => ({
  error: { code, message, details, request_id: 'req_1' },
});

/** A fake API that answers every request with `reply` and records what was sent. */
function fakeApi(reply: (call: Call) => { status?: number; body?: unknown }) {
  const calls: Call[] = [];
  const onSignedOut = vi.fn();
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const url = String(input);
    const call: Call = {
      method: init?.method ?? 'GET',
      url,
      query: new URL(url).searchParams,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    const { status = 200, body = null } = reply(call);
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  });
  const http = createHttpClient({ baseUrl: 'http://api.test', client: 'web', fetch, onSignedOut });
  return { repo: createHttpAdminTrustRepo(http), calls, onSignedOut };
}

const STAFF_A = '8a41c0e9-2d3b-4c5a-9e8f-7a6b5c4d0f12';
const STAFF_B = '0b2e77e5-6c1d-4e2f-8a3b-9c4d5e6f7a81';
const USER = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f4f2a';
const RESUME = '1d2e3f4a-5b6c-4d7e-8f90-a1b2c3d49c10';
const TECH = '9e8d7c6b-5a49-4382-9716-05f4e3d2e1d0';
const PROMPT_VERSION = 'c0ffee00-1234-4abc-8def-0123456789ab';

/** One `audit.searchAudit` row: numeric id, nullable target and reason, jsonb before/after. */
const row = (
  id: number,
  fields: { actor?: string | null; role?: string; action: string } & Partial<{
    targetType: string | null;
    targetId: string | null;
    before: unknown;
    after: unknown;
    reason: string | null;
    ip: string | null;
  }>,
) => ({
  id,
  actorUserId: fields.actor === undefined ? STAFF_A : fields.actor,
  actorRole: fields.role ?? 'admin',
  action: fields.action,
  targetType: fields.targetType ?? null,
  targetId: fields.targetId ?? null,
  before: fields.before ?? null,
  after: fields.after ?? null,
  reason: fields.reason ?? null,
  ip: fields.ip === undefined ? '102.89.53.14' : fields.ip,
  requestId: `req_${id}`,
  createdAt: new Date(NOW.getTime() - id * 60_000).toISOString(),
});

/** Every kind of row the admin services write (`writeAudit` callers), newest first. */
const LOG = [
  row(1, {
    role: 'support',
    actor: STAFF_B,
    action: 'user.password_reset',
    targetType: 'user',
    targetId: USER,
  }),
  row(2, {
    action: 'user.content_read',
    targetType: 'resume',
    targetId: RESUME,
    after: { userId: USER },
    reason: 'Ticket 2231 · export layout broken',
  }),
  row(3, {
    role: 'super_admin',
    action: 'staff.roles',
    targetType: 'user',
    targetId: STAFF_B,
    before: { role: 'support' },
    after: { groups: ['curator'] },
  }),
  row(4, {
    action: 'provider.update',
    targetType: 'job_provider',
    targetId: 'adzuna',
    before: { enabled: true, priority: 20, limits: { dailyCalls: 250 } },
    after: { enabled: false, priority: 20, limits: { dailyCalls: 250 } },
  }),
  row(5, {
    role: 'curator',
    action: 'kb.update',
    targetType: 'technology',
    targetId: TECH,
    before: { id: TECH, name: 'Next.js', review_status: 'llm_seeded' },
    after: { id: TECH, name: 'Next.js', review_status: 'admin_reviewed' },
  }),
  row(6, {
    role: 'curator',
    action: 'prompt.draft',
    targetType: 'prompt',
    targetId: PROMPT_VERSION,
    after: { name: 'tailor.rewrite', version: 15 },
  }),
  row(7, {
    action: 'plan.prices',
    targetType: 'plan',
    targetId: 'pro_monthly',
    before: { prices: { USD: 1900 }, price_version: 1, tier: 'pro' },
    after: { prices: { USD: 2100 }, price_version: 2 },
  }),
  row(8, {
    role: 'curator',
    action: 'template.publish',
    targetType: 'template',
    targetId: 'modern',
  }),
  row(9, {
    role: 'curator',
    action: 'kb.dataset_publish',
    targetType: 'kb_dataset',
    targetId: '3',
    after: { notes: 'Q4' },
  }),
  row(10, {
    actor: null,
    action: 'user.suspend',
    targetType: 'user',
    targetId: USER,
    reason: 'abuse: RPT-1029',
    ip: null,
  }),
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('the audit log', () => {
  it('names the staff member behind each row, and masks an id the names don’t know', async () => {
    const { repo } = fakeApi((call) => ({
      body: call.url.endsWith('/admin/staff/names')
        ? { data: { [LOG[0]!.actorUserId!]: 'Priya R.' } }
        : { data: LOG },
    }));
    const page = await repo.audit(EMPTY_AUDIT_FILTERS, 1);
    expect(page.rows.find((r) => r.staff.id === LOG[0]!.actorUserId)!.staff.name).toBe('Priya R.');
  });

  it('asks for the window’s newest 500 rows and maps each kind the services write', async () => {
    const { repo, calls } = fakeApi(() => ({ body: { data: LOG } }));
    const page = await repo.audit(EMPTY_AUDIT_FILTERS, 1);

    const from = new Date(NOW.getTime() - 30 * DAY).toISOString();
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      `GET http://api.test/api/v1/admin/audit?from=${encodeURIComponent(from)}&limit=500`,
      'GET http://api.test/api/v1/admin/staff/names',
    ]);
    expect(page.rows.map((r) => [r.action, r.target.type, r.target.label])).toEqual([
      ['Sent a password reset', 'user', 'user ···4f2a'],
      ['Opened resume content', 'resume', 'resume ···9c10'],
      ['Changed role', 'staff', 'staff ···7a81'],
      ['Paused provider', 'provider', 'provider adzuna'],
      ['Approved KB change', 'technology', 'tech ···e1d0'],
      ['Drafted prompt', 'prompt', 'tailor.rewrite v15'],
      ['Changed plan prices', 'user', 'plan pro_monthly'],
      ['Published template', 'prompt', 'template modern'],
      ['Published KB dataset', 'technology', 'KB dataset v3'],
      ['Suspended an account', 'user', 'user ···4f2a'],
    ]);
    expect(page.rows[0]).toEqual({
      id: '1',
      at: '2026-11-05T11:59:00.000Z',
      staff: { id: STAFF_B, name: 'staff ···7a81', role: 'support' },
      action: 'Sent a password reset',
      contentRead: false,
      target: { type: 'user', label: 'user ···4f2a' },
      reason: '—',
      ip: '102.89.53.14',
    });
    expect(page.rows[1]).toMatchObject({
      contentRead: true,
      reason: 'Ticket 2231 · export layout broken',
    });
    expect(page.rows[9]).toMatchObject({
      staff: { id: 'system', name: 'System' },
      reason: 'abuse: RPT-1029',
      ip: '',
    });
    expect(page).toMatchObject({ total: 10, pages: 1 });
    expect(page.staffOptions).toEqual([
      { id: STAFF_B, name: 'staff ···7a81' },
      { id: STAFF_A, name: 'staff ···0f12' },
      { id: 'system', name: 'System' },
    ]);
    expect(page.actionOptions).toEqual([...page.actionOptions].sort());
    expect(page.actionOptions).toContain('Paused provider');
  });

  it('sends what the API filters on in its own terms', async () => {
    const { repo, calls } = fakeApi(() => ({ body: { data: [] } }));
    const query = async (filters: Partial<AuditFilters>) => {
      await repo.audit({ ...EMPTY_AUDIT_FILTERS, ...filters }, 1);
      return Object.fromEntries(calls.filter((c) => c.url.includes('/admin/audit')).at(-1)!.query);
    };

    expect(await query({ range: 'all' })).toEqual({ limit: '500' });
    expect(await query({ range: 'all', action: 'Suspended an account' })).toEqual({
      action: 'user.suspend',
      limit: '500',
    });
    // A refined label asks for its code; the rows are narrowed to the label afterwards.
    expect(await query({ range: 'all', action: 'Paused provider' })).toMatchObject({
      action: 'provider.update',
    });
    // An action the map doesn't know is the server's own code, and goes as it is.
    expect(await query({ range: 'all', action: 'billing.refund' })).toMatchObject({
      action: 'billing.refund',
    });
    expect(await query({ range: 'all', targetType: 'provider' })).toEqual({
      targetType: 'job_provider',
      limit: '500',
    });
    expect(await query({ range: 'all', targetType: 'staff' })).toEqual({
      action: 'staff.roles',
      targetType: 'user',
      limit: '500',
    });
    expect(await query({ range: 'all', staff: STAFF_A })).toEqual({ actor: STAFF_A, limit: '500' });
    // "System" has no id the API could match.
    expect(await query({ range: 'all', staff: 'system' })).toEqual({ limit: '500' });
    expect(await query({ range: '7d' })).toEqual({
      from: new Date(NOW.getTime() - 7 * DAY).toISOString(),
      limit: '500',
    });
  });

  it('narrows the served rows by what the API can’t filter', async () => {
    const { repo } = fakeApi((call) => {
      const action = call.query.get('action');
      const targetType = call.query.get('targetType');
      return {
        body: {
          data: LOG.filter(
            (r) => (!action || r.action === action) && (!targetType || r.targetType === targetType),
          ),
        },
      };
    });
    const rows = async (filters: Partial<AuditFilters>) =>
      (await repo.audit({ ...EMPTY_AUDIT_FILTERS, ...filters }, 1)).rows.map((r) => r.id);

    // Users: the API's `user` rows less the role change, which is a staff target.
    expect(await rows({ targetType: 'user' })).toEqual(['1', '10']);
    expect(await rows({ targetType: 'staff' })).toEqual(['3']);
    expect(await rows({ staff: 'system' })).toEqual(['10']);
    expect(await rows({ search: 'export layout' })).toEqual(['2']);
    expect(await rows({ search: 'pro_monthly' })).toEqual(['7']);
  });

  it('a full 500 means the count isn’t known, even once the search narrows it', async () => {
    const full = Array.from({ length: 500 }, (_, index) =>
      row(index + 1, {
        action: index % 2 ? 'user.suspend' : 'user.reactivate',
        targetType: 'user',
        targetId: USER,
        reason: index < 30 ? 'appeal' : 'abuse',
      }),
    );
    const { repo } = fakeApi(() => ({ body: { data: full } }));

    const all = await repo.audit(EMPTY_AUDIT_FILTERS, 2);
    expect(all).toMatchObject({ total: null, pages: 42 });
    expect(all.rows.map((r) => r.id)).toEqual(
      Array.from({ length: 12 }, (_, index) => String(13 + index)),
    );

    const searched = await repo.audit({ ...EMPTY_AUDIT_FILTERS, search: 'appeal' }, 9);
    expect(searched).toMatchObject({ total: null, pages: 3 });
    // A page past the end shows the last one.
    expect(searched.rows.map((r) => r.id)).toEqual(['25', '26', '27', '28', '29', '30']);
  });

  it('keeps everyone in the staff menu after narrowing to one of them', async () => {
    const { repo } = fakeApi((call) => ({
      body: {
        data: LOG.filter(
          (r) => !call.query.get('actor') || r.actorUserId === call.query.get('actor'),
        ),
      },
    }));
    await repo.audit(EMPTY_AUDIT_FILTERS, 1);
    const narrowed = await repo.audit({ ...EMPTY_AUDIT_FILTERS, staff: STAFF_B }, 1);

    expect(narrowed.rows.map((r) => r.id)).toEqual(['1']);
    expect(narrowed.staffOptions.map((s) => s.id)).toEqual([STAFF_B, STAFF_A, 'system']);
  });

  it('exports through the API’s CSV route with the same filters, fetching nothing', async () => {
    const { repo, calls } = fakeApi(() => ({ body: { data: [] } }));
    const file = await repo.exportAudit({
      ...EMPTY_AUDIT_FILTERS,
      range: '90d',
      action: 'Set provider key',
      targetType: 'provider',
    });
    const from = encodeURIComponent(new Date(NOW.getTime() - 90 * DAY).toISOString());
    const query = `from=${from}&action=provider.key&targetType=job_provider`;
    expect(file).toEqual({
      kind: 'url',
      url: `http://api.test/api/v1/admin/audit/export?${query}`,
    });
    expect(calls).toHaveLength(0);
  });

  it('an audit read the role may not make fails as the server said', async () => {
    const { repo } = fakeApi(() => ({
      status: 403,
      body: envelope('FORBIDDEN', 'You do not have access to this.'),
    }));
    await expect(repo.audit(EMPTY_AUDIT_FILTERS, 1)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
  });
});

/** `/admin/settings`: what `services/admin/staffSettings.ts` answers. */
const SETTINGS = {
  requireMfa: true,
  authenticator: { addedAt: '2026-11-01T09:00:00.000Z', lastUsedAt: '2026-11-05T08:12:00.000Z' },
  backupCodes: { unused: 9, total: 10 },
  sessionTimeoutMinutes: 30,
  reauthForSensitive: true,
  allowedNetworks: [{ cidr: '203.0.113.0/24', label: 'Office' }],
  currentIp: '203.0.113.7',
  lastSignIn: { at: '2026-11-05T08:12:00.000Z', ip: '203.0.113.7' },
  retention: [{ label: 'Audit log', value: 'Kept indefinitely, append-only' }],
};

describe('Settings (`/admin/settings*`)', () => {
  it('reads and patches the policy, and reads a new member with no authenticator yet', async () => {
    const { repo, calls } = fakeApi((call) => ({
      body:
        call.method === 'PATCH'
          ? { ...SETTINGS, sessionTimeoutMinutes: 15 }
          : { ...SETTINGS, authenticator: null, lastSignIn: null, currentIp: null },
    }));
    expect((await repo.settings())!.authenticator).toBeNull();
    expect((await repo.updateSettings({ sessionTimeoutMinutes: 15 })).sessionTimeoutMinutes).toBe(
      15,
    );
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'GET http://api.test/api/v1/admin/settings',
      'PATCH http://api.test/api/v1/admin/settings',
    ]);
    expect(calls[1]!.body).toEqual({ sessionTimeoutMinutes: 15 });
  });

  it('regenerates backup codes and replaces the authenticator in two steps', async () => {
    const { repo, calls } = fakeApi((call) => ({
      body: call.url.endsWith('/backup-codes')
        ? { codes: ['4f2a-9c10'] }
        : call.url.endsWith('/confirm')
          ? { backupCodes: ['aaaa-bbbb'] }
          : {
              challenge: 'c'.repeat(32),
              secret: 'JBSWY3DPEHPK3PXP',
              otpauthUrl: 'otpauth://totp/NextKin:ana',
            },
    }));
    expect(await repo.regenerateBackupCodes()).toEqual(['4f2a-9c10']);
    const setup = await repo.beginAuthenticatorReplacement();
    expect(setup.otpauthUrl).toContain('otpauth://');
    expect(
      await repo.confirmAuthenticatorReplacement({ challenge: setup.challenge, code: ' 123456 ' }),
    ).toEqual(['aaaa-bbbb']);
    expect(calls[2]!.body).toEqual({ challenge: setup.challenge, code: '123456' });
  });
});

/** `sessionUserSchema`: the user a signed-in step carries. */
const USER_WIRE = {
  id: STAFF_A,
  email: 'ana@nextkin.test',
  firstName: 'Ana',
  lastName: 'L.',
  emailVerified: true,
  role: 'admin',
};

describe('staff sign-in', () => {
  it('a right password without a code is the code step, not a sign-out', async () => {
    const { repo, calls, onSignedOut } = fakeApi(() => ({ body: { status: 'mfa_required' } }));
    expect(await repo.signIn({ email: 'ana@nextkin.test', password: 'pw' })).toEqual({
      status: 'mfa_required',
    });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'POST http://api.test/api/v1/auth/admin/login',
    ]);
    // `adminLoginSchema` is strict: no empty `totp` key goes with the first step.
    expect(calls[0]!.body).toEqual({ email: 'ana@nextkin.test', password: 'pw' });
    expect(onSignedOut).not.toHaveBeenCalled();
  });

  it('the six digits or a backup code sign in', async () => {
    const { repo, calls } = fakeApi(() => ({ body: { status: 'signed_in', user: USER_WIRE } }));
    expect(
      await repo.signIn({ email: 'ana@nextkin.test', password: 'pw', totp: '123456' }),
    ).toEqual({ status: 'signed_in' });
    expect(
      await repo.signIn({ email: 'ana@nextkin.test', password: 'pw', totp: '4f2a-9c10' }),
    ).toEqual({ status: 'signed_in' });
    expect(calls[1]!.body).toEqual({
      email: 'ana@nextkin.test',
      password: 'pw',
      totp: '4f2a-9c10',
    });
  });

  it('a first sign-in sets up the authenticator, then replaces the temporary password', async () => {
    const { repo, calls } = fakeApi((call) => ({
      body: call.url.endsWith('/login')
        ? {
            status: 'enroll_totp',
            challenge: 'e'.repeat(32),
            secret: 'JBSWY3DPEHPK3PXP',
            otpauthUrl: 'otpauth://totp/NextKin:new',
          }
        : call.url.endsWith('/enroll')
          ? { status: 'change_password', challenge: 'p'.repeat(32), backupCodes: ['4f2a-9c10'] }
          : { status: 'signed_in', user: USER_WIRE },
    }));
    const first = await repo.signIn({ email: 'new@nextkin.test', password: 'temporary' });
    expect(first).toMatchObject({ status: 'enroll_totp', secret: 'JBSWY3DPEHPK3PXP' });
    expect(await repo.confirmEnrollment({ challenge: 'e'.repeat(32), code: '123456' })).toEqual({
      status: 'change_password',
      challenge: 'p'.repeat(32),
      backupCodes: ['4f2a-9c10'],
    });
    expect(
      await repo.setNewPassword({ challenge: 'p'.repeat(32), password: 'a long new passphrase' }),
    ).toEqual({ status: 'signed_in' });
    expect(calls.map((c) => c.url.split('/v1')[1])).toEqual([
      '/auth/admin/login',
      '/auth/admin/enroll',
      '/auth/admin/password',
    ]);
  });

  it('a wrong code is refused as a wrong code, and doesn’t sign anyone out', async () => {
    // `invalid_credentials` becomes `errors.unauthenticated()`: "Sign in to continue."
    const { repo, onSignedOut } = fakeApi(() => ({
      status: 401,
      body: envelope('UNAUTHENTICATED', 'Sign in to continue.'),
    }));
    await expect(
      repo.signIn({ email: 'ana@nextkin.test', password: 'pw', totp: '000000' }),
    ).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      status: 401,
      message: 'That code didn’t work. Check your app and try again.',
    });
    expect(onSignedOut).not.toHaveBeenCalled();
  });

  it('a wrong password says the email and password don’t match, not “Sign in to continue”', async () => {
    const { repo } = fakeApi(() => ({
      status: 401,
      body: envelope('UNAUTHENTICATED', 'Sign in to continue.'),
    }));
    await expect(
      repo.signIn({ email: 'ana@nextkin.test', password: 'nope' }),
    ).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      message: 'That email and password don’t match a staff account.',
    });
  });

  it('a refusal that isn’t about the credentials keeps the server’s words', async () => {
    const { repo } = fakeApi(() => ({
      status: 429,
      body: envelope('RATE_LIMITED', 'Too many attempts. Try again in a minute.'),
    }));
    await expect(repo.signIn({ email: 'ana@nextkin.test', password: 'pw' })).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      message: 'Too many attempts. Try again in a minute.',
    });
  });

  it('a 200 that isn’t a step is not a sign-in', async () => {
    const { repo } = fakeApi(() => ({ body: { ok: true } }));
    await expect(
      repo.signIn({ email: 'ana@nextkin.test', password: 'pw', totp: '123456' }),
    ).rejects.toThrow();
  });
});

// --- Generation failures and abuse reports (`services/admin/trustFailures.ts`, `trustReports.ts`) --

const RUN_A = '01937c2e-0000-7000-8000-00000000a001';
const RUN_B = '01937c2e-0000-7000-8000-00000000b002';
const RUN_C = '01937c2e-0000-7000-8000-00000000c003';

/** One `listFailures` row, as the route answers it. */
const run = (
  id: string,
  fields: Partial<{ kind: string; status: string; errorCode: string; stage: string; ago: number }>,
) => ({
  id,
  kind: fields.kind ?? 'tailor',
  stage: fields.stage ?? 'generate',
  errorCode: fields.errorCode ?? 'dead_lettered',
  userRef: USER,
  attempts: 5,
  maxAttempts: 5,
  failedAt: new Date(NOW.getTime() - (fields.ago ?? 1) * 3_600_000).toISOString(),
  status: fields.status ?? 'open',
});

const QUEUE = {
  data: [
    run(RUN_A, { ago: 1 }),
    run(RUN_B, { kind: 'cover_letter', status: 'retrying', errorCode: 'timed_out', ago: 2 }),
    run(RUN_C, { kind: 'ats_check', status: 'resolved', errorCode: 'provider', ago: 30 }),
  ],
  capped: false,
  limit: 1000,
};

describe('generation failures', () => {
  beforeEach(() => vi.useFakeTimers({ now: NOW, toFake: ['Date'] }));
  afterEach(() => vi.useRealTimers());

  const query = { status: 'all' as const, search: '', kinds: [], page: 1 };

  it('writes the cards from the figures the server counts', async () => {
    const { repo, calls } = fakeApi(() => ({
      body: {
        failed30d: 46,
        totalRuns30d: 1840,
        open: 1,
        oldestOpenAt: new Date(NOW.getTime() - 2 * 3_600_000).toISOString(),
        openRetriesUsedUp: true,
        retried30d: 10,
        retriedOk30d: 8,
        mostCommon: { errorCode: 'dead_lettered', stage: 'generate', runs: 12 },
        capped: false,
      },
    }));
    const stats = await repo.failureStats();
    expect(calls[0]!.url).toBe('http://api.test/api/v1/admin/failures/stats');
    expect(stats).toEqual({
      failed30d: 46,
      failedRate: 46 / 1840,
      totalRuns: 1840,
      open: 1,
      openNote: 'oldest 2 h ago · retries used up',
      retriedOk: 8,
      retriedOkRate: 0.8,
      mostCommon: { label: 'Retries used up', stage: 'generate', runs: 12 },
    });
  });

  it('with nothing open or retried, says so rather than dividing by zero', async () => {
    const { repo } = fakeApi(() => ({
      body: {
        failed30d: 0,
        totalRuns30d: 0,
        open: 0,
        oldestOpenAt: null,
        openRetriesUsedUp: false,
        retried30d: 0,
        retriedOk30d: 0,
        mostCommon: null,
        capped: false,
      },
    }));
    expect(await repo.failureStats()).toMatchObject({
      failedRate: 0,
      openNote: 'nothing waiting',
      retriedOkRate: 0,
      mostCommon: null,
    });
  });

  it('filters, counts and pages the served queue as the mock does', async () => {
    const { repo } = fakeApi(() => ({ body: QUEUE }));
    const open = await repo.failures({ ...query, status: 'open' });
    expect(open!.rows.map((r) => r.id)).toEqual([RUN_A]);
    expect(open!.counts).toEqual({ open: 1, retrying: 1, resolved: 1, all: 3 });
    const letters = await repo.failures({ ...query, kinds: ['cover_letter'] });
    expect(letters!.rows.map((r) => r.id)).toEqual([RUN_B]);
    expect(letters!.counts.all).toBe(1);
    const searched = await repo.failures({ ...query, search: 'b002' });
    expect(searched!.total).toBe(1);
  });

  it('maps the drawer, labels the failed stage, and keeps missing facts missing', async () => {
    const { repo, calls } = fakeApi(() => ({
      body: {
        ...run(RUN_A, {}),
        stages: [
          { name: 'jd', outcome: 'done', detail: 'claude-x', seconds: 1.2 },
          { name: 'generate', outcome: 'failed', detail: 'We couldn’t finish this. Try again.' },
          { name: 'persist', outcome: 'skipped', detail: 'Not reached' },
        ],
        error: {
          message: 'We couldn’t finish this. Try again.',
          requestRef: null,
          retryPolicy: 'up to 5 deliveries',
        },
        prompt: null,
        model: null,
        tokensIn: 0,
        tokensOut: 0,
        startedAt: NOW.toISOString(),
        endedAt: null,
      },
    }));
    const detail = await repo.failureDetail(RUN_A);
    expect(calls[0]!.url).toBe(`http://api.test/api/v1/admin/failures/${RUN_A}`);
    expect(detail!.stages[1]).toEqual({
      name: 'generate',
      outcome: 'failed',
      detail: 'We couldn’t finish this. Try again.',
      label: 'Retries used up',
    });
    expect(detail).toMatchObject({
      prompt: null,
      model: null,
      endedAt: null,
      error: { requestRef: null },
    });
  });

  it('retries through the API; runs that weren’t open pass quietly, a refused one says why', async () => {
    const quiet = fakeApi(() => ({
      body: { retried: [RUN_A], skipped: [{ id: RUN_B, reason: 'retrying' }] },
    }));
    await expect(quiet.repo.retryFailures([RUN_A, RUN_B])).resolves.toBeUndefined();
    expect(quiet.calls[0]).toMatchObject({ method: 'POST', body: { ids: [RUN_A, RUN_B] } });

    const refused = fakeApi(() => ({
      body: { retried: [RUN_A], skipped: [{ id: RUN_C, reason: 'quota' }] },
    }));
    await expect(refused.repo.retryFailures([RUN_A, RUN_C])).rejects.toThrow(
      'Retried 1 run; 1 run couldn’t be: the user is at their plan’s limit.',
    );
  });

  it('resolves by id, and exports the filtered queue as the mock’s CSV', async () => {
    const { repo, calls } = fakeApi((call) => ({
      body: call.method === 'POST' ? { status: 'resolved' } : QUEUE,
    }));
    await repo.resolveFailure(RUN_A);
    expect(calls[0]).toMatchObject({
      method: 'POST',
      url: `http://api.test/api/v1/admin/failures/${RUN_A}/resolve`,
    });
    const csv = await repo.exportFailures({ ...query, status: 'open' });
    expect(csv.split('\n')).toEqual([
      'run,kind,stage,error_code,user,attempts,failed_at,status',
      `run ···a001,Tailor,generate,dead_lettered,user ···4f2a,5 of 5,${QUEUE.data[0]!.failedAt},open`,
    ]);
  });
});

const LINK = '01937c2e-0000-7000-8000-0000000011ab';

/** One `listReports` row. */
const report = (n: number, status: string, category = 'spam', hoursAgo = 3) => ({
  id: `RPT-${n}`,
  category,
  item: { kind: 'public_link', ref: LINK },
  receivedAt: new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString(),
  status,
  reporter: 'anonymous',
});

describe('abuse reports', () => {
  beforeEach(() => vi.useFakeTimers({ now: NOW, toFake: ['Date'] }));
  afterEach(() => vi.useRealTimers());

  it('writes the cards from the server’s counts and median', async () => {
    const { repo } = fakeApi(() => ({
      body: {
        open: 2,
        oldestOpenAt: new Date(NOW.getTime() - 3 * 3_600_000).toISOString(),
        resolved30d: 14,
        settled30d: { dismissed: 9, linksDisabled: 4, suspensions: 1 },
        medianResolveHours: 5.5,
        targetHours: 24,
      },
    }));
    expect(await repo.reportStats()).toEqual({
      open: 2,
      openNote: 'oldest received 3 h ago',
      resolved30d: 14,
      resolvedNote: '9 dismissed · 4 links disabled · 1 suspension',
      medianResolveHours: 5.5,
      targetHours: 24,
    });
  });

  it('pages the served reports; Resolved holds the dismissed ones too', async () => {
    const { repo } = fakeApi(() => ({
      body: {
        data: [
          report(1003, 'open'),
          report(1002, 'dismissed', 'harassment'),
          report(1001, 'resolved'),
        ],
        capped: false,
      },
    }));
    const settled = await repo.reports('resolved', '', 1);
    expect(settled!.rows.map((r) => r.id)).toEqual(['RPT-1002', 'RPT-1001']);
    expect(settled!.counts).toEqual({ open: 1, resolved: 2, all: 3 });
    expect((await repo.reports('all', '', 1, ['harassment']))!.total).toBe(1);
  });

  it('maps a report and settles it with the action, reason and note', async () => {
    const detail = {
      ...report(1003, 'open'),
      reason: 'Uses my name',
      ownerRef: USER,
      linkCreatedAt: new Date(NOW.getTime() - 5 * DAY).toISOString(),
      views: null,
      prior: { count: 2, latestAt: new Date(NOW.getTime() - 2 * DAY).toISOString() },
      outcome: null,
    };
    const { repo, calls } = fakeApi((call) => ({
      body:
        call.method === 'POST'
          ? {
              ...detail,
              status: 'resolved',
              outcome: { action: 'disable_link', reason: 'spam', note: 'n', at: NOW.toISOString() },
            }
          : detail,
    }));
    expect(await repo.report('RPT-1003')).toMatchObject({
      views: null,
      prior: { count: 2, note: 'against this owner, latest 2 d ago' },
    });
    const settled = await repo.actOnReport('RPT-1003', {
      action: 'disable_link',
      reason: 'spam',
      note: 'n',
    });
    expect(calls[1]).toMatchObject({
      method: 'POST',
      url: 'http://api.test/api/v1/admin/reports/RPT-1003/action',
      body: { action: 'disable_link', reason: 'spam', note: 'n' },
    });
    expect(settled.outcome).toMatchObject({ action: 'disable_link' });
  });
});
