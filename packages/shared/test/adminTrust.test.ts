import { describe, expect, it, vi } from 'vitest';

import { useMockModeStore } from '../src/mock/mode';
import {
  adminAuditFixture,
  adminFailuresFixture,
  adminReportsFixture,
  adminSettingsFixture,
  failureDetailFixture,
} from '../src/mock/fixtures/adminTrust';
import { EMPTY_AUDIT_FILTERS } from '../src/models/adminTrust';
import { createMockAdminPeopleRepo } from '../src/repos/adminPeopleMockRepo';
import {
  auditCsv,
  createMockAdminTrustRepo,
  isNetwork,
  matchesAudit,
  networkCovers,
} from '../src/repos/adminTrustRepo';
import { resetAdminMocks } from '../src/repos/adminMockReset';
import { createHttpClient } from '../src/repos/http/client';
import { createHttpAdminTrustRepo } from '../src/repos/http/adminTrustRepo';

/** Trust & safety's data (Figma 406:1195, 407:946, 408:1531, 409:1500). Synthetic only. */

describe('the fixtures', () => {
  it('hold the boards’ totals', () => {
    expect(adminFailuresFixture).toHaveLength(461);
    expect(adminFailuresFixture.filter((row) => row.status === 'open')).toHaveLength(7);
    expect(adminReportsFixture).toHaveLength(16);
    expect(adminReportsFixture.filter((row) => row.status === 'open')).toHaveLength(2);
    expect(adminAuditFixture.filter((row) => matchesAudit(row, EMPTY_AUDIT_FILTERS))).toHaveLength(
      2204,
    );
  });

  it('describe the drawn run as the drawer draws it', () => {
    const run = adminFailuresFixture.find((row) => row.id.endsWith('c51a'))!;
    const detail = failureDetailFixture(run);
    expect(detail.stages.map((stage) => [stage.name, stage.outcome])).toEqual([
      ['resume.parse', 'done'],
      ['jd.structure', 'done'],
      ['tailor.rewrite', 'failed'],
      ['ai.review', 'skipped'],
      ['render', 'skipped'],
    ]);
    expect(detail.error.requestRef?.endsWith('93ab')).toBe(true);
    expect(detail.tokensIn).toBe(3912);
  });
});

describe('allowed networks', () => {
  it('accept an address or a CIDR range and nothing else', () => {
    expect(isNetwork('203.0.113.0/24')).toBe(true);
    expect(isNetwork('73.158.12.90')).toBe(true);
    expect(isNetwork('300.1.1.1')).toBe(false);
    expect(isNetwork('10.0.0.0/33')).toBe(false);
    expect(isNetwork('office')).toBe(false);
  });

  it('know which addresses a range covers', () => {
    expect(networkCovers('41.216.0.0/16', '41.216.88.7')).toBe(true);
    expect(networkCovers('41.216.0.0/16', '41.217.0.1')).toBe(false);
    expect(networkCovers('73.158.12.90', '73.158.12.90')).toBe(true);
    expect(networkCovers('0.0.0.0/0', '8.8.8.8')).toBe(true);
  });
});

describe('the mock repository', () => {
  it('queues a retry, resolves a run, and puts both back on reset', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const repo = createMockAdminTrustRepo();
    const open = adminFailuresFixture.filter((row) => row.status === 'open');
    const settle = async <T>(promise: Promise<T>) => {
      await vi.runAllTimersAsync();
      return promise;
    };

    await settle(repo.retryFailures([open[0]!.id]));
    await settle(repo.resolveFailure(open[1]!.id));
    const page = await settle(repo.failures({ status: 'open', search: '', kinds: [], page: 1 }));
    expect(page!.counts.open).toBe(5);
    expect(page!.counts.retrying).toBe(3);

    resetAdminMocks();
    const fresh = await settle(repo.failures({ status: 'all', search: '', kinds: [], page: 1 }));
    expect(fresh!.counts.open).toBe(7);
    vi.useRealTimers();
  });

  const settled = async <T>(promise: Promise<T>) => {
    await vi.runAllTimersAsync();
    return promise;
  };

  it('records what staff do, in every area, at the top of the audit log until reset', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    resetAdminMocks();
    const trust = createMockAdminTrustRepo();
    const people = createMockAdminPeopleRepo();

    await settled(trust.updateSettings({ reauthForSensitive: false }));
    await settled(
      trust.confirmAuthenticatorReplacement({ challenge: 'mock-enrol-step', code: '123456' }),
    );
    const users = await settled(people.listUsers({ filter: 'all', q: '', sort: 'desc', page: 1 }));
    const target = users.rows[0]!;
    await settled(people.suspendUser(target.id, { reason: 'abuse', note: '', notify: false }));

    const page = await settled(trust.audit(EMPTY_AUDIT_FILTERS, 1));
    expect(page.total).toBe(2204 + 3);
    expect(page.rows.slice(0, 3).map((row) => row.action)).toEqual([
      'Suspended an account',
      'Replaced authenticator',
      'Changed re-auth rule',
    ]);
    expect(page.rows[0]).toMatchObject({
      staff: { name: 'Ehsan', role: 'super_admin' },
      target: { type: 'user', label: `user ···${target.id.slice(-4)}` },
    });
    expect(page.actionOptions).toContain('Replaced authenticator');

    resetAdminMocks();
    const fresh = await settled(trust.audit(EMPTY_AUDIT_FILTERS, 1));
    expect(fresh.total).toBe(2204);
    vi.useRealTimers();
  });

  it('never writes or searches a whole IP address', async () => {
    resetAdminMocks();
    const csv = auditCsv(adminAuditFixture.slice(0, 3));
    expect(csv).toContain('102.89.···.14');
    expect(csv).not.toContain('102.89.53.14');
    const filters = { ...EMPTY_AUDIT_FILTERS, range: 'all' as const };
    expect(
      adminAuditFixture.some((row) => matchesAudit(row, { ...filters, search: '53.14' })),
    ).toBe(false);
    expect(
      adminAuditFixture.some((row) => matchesAudit(row, { ...filters, search: '102.89' })),
    ).toBe(true);
    resetAdminMocks();
  });

  it('accepts a backup code once per code, spending one from Settings', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    resetAdminMocks();
    const repo = createMockAdminTrustRepo();
    const input = { email: 'ehsan@nextkin.ai', password: 'x', totp: '4f2a-9c10' };
    expect(await settled(repo.signIn(input))).toEqual({ status: 'signed_in' });
    expect((await settled(repo.settings()))!.backupCodes.unused).toBe(7);
    const refused = expect(repo.signIn({ ...input, totp: '12ab' })).rejects.toThrow();
    await vi.runAllTimersAsync();
    await refused;
    vi.useRealTimers();
  });

  it('serves an empty Settings in the empty mode', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useMockModeStore.setState({ mode: 'empty' });
    const settings = await settled(createMockAdminTrustRepo().settings());
    expect(settings!.allowedNetworks).toEqual([]);
    expect(settings!.backupCodes.unused).toBe(0);
    useMockModeStore.setState({ mode: 'normal' });
    vi.useRealTimers();
  });

  it('never dates the authenticator in the future', () => {
    expect(new Date(adminSettingsFixture().authenticator!.addedAt).getTime()).toBeLessThanOrEqual(
      Date.now(),
    );
  });
});

describe('the HTTP repository', () => {
  const response = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('masks audit rows the server returns and never invents the unserved queues', async () => {
    const fetch = vi.fn(async () =>
      response({
        data: [
          {
            id: 7,
            actorUserId: 'stf_000000k9m2',
            actorRole: 'support',
            action: 'user.password_reset',
            targetType: 'user',
            targetId: 'usr_0000004f2a',
            reason: 'user_request',
            ip: '102.89.53.14',
            createdAt: '2026-11-05T10:42:18.000Z',
          },
        ],
      }),
    );
    const repo = createHttpAdminTrustRepo(
      createHttpClient({ baseUrl: 'http://api.test', client: 'web', fetch }),
    );
    const page = await repo.audit(EMPTY_AUDIT_FILTERS, 1);
    expect(page.rows[0]).toMatchObject({
      staff: { name: 'staff ···k9m2', role: 'support' },
      target: { type: 'user', label: 'user ···4f2a' },
    });
    expect(page.total).toBe(1);
  });

  it('turns the server’s “code required” into the code step', async () => {
    const fetch = vi.fn(async () => response({ status: 'mfa_required' }, 200));
    const repo = createHttpAdminTrustRepo(
      createHttpClient({ baseUrl: 'http://api.test', client: 'web', fetch }),
    );
    expect(await repo.signIn({ email: 'a@b.test', password: 'x' })).toEqual({
      status: 'mfa_required',
    });
  });
});
