import { describe, expect, it, vi } from 'vitest';

import { adminDeletionFixture } from '../src/mock/fixtures/adminPeople';
import { useMockModeStore } from '../src/mock/mode';
import { createMockAdminPeopleRepo, deletionStatsOf } from '../src/repos/adminPeopleRepo';
import { resetAdminMocks } from '../src/repos/adminMockReset';
import { createHttpAdminPeopleRepo } from '../src/repos/http/adminPeopleRepo';
import type { HttpClient } from '../src/repos/http/client';

/** The People area's data (Figma 404:614–408:2745). Synthetic records only. */

describe('the deletion queue', () => {
  it('works out the board’s cards from the requests', () => {
    const stats = deletionStatsOf(adminDeletionFixture);
    expect(stats.open).toBe(3);
    expect(stats.dueIn7Days).toBe(1);
    expect(stats.completed30).toBe(18);
    expect(stats.completedPastLimit).toBe(0);
    expect(stats.overdue).toBe(0);
    expect(stats.averageDays).toBe(6.2);
  });

  it('counts an overdue request as overdue, never as due soon', () => {
    const now = Date.parse('2026-11-05T12:00:00Z');
    const day = 86_400_000;
    const at = (offset: number) => new Date(now + offset * day).toISOString();
    const stats = deletionStatsOf(
      [
        {
          id: 'del_late',
          userId: 'usr_late',
          origin: 'user',
          requestedAt: at(-33),
          dueAt: at(-3),
          status: 'scheduled',
          completedAt: null,
        },
        {
          id: 'del_soon',
          userId: 'usr_soon',
          origin: 'user',
          requestedAt: at(-25),
          dueAt: at(5),
          status: 'scheduled',
          completedAt: null,
        },
        {
          id: 'del_slow',
          userId: 'usr_slow',
          origin: 'admin',
          requestedAt: at(-80),
          dueAt: at(-50),
          status: 'completed',
          completedAt: at(-40),
        },
      ],
      now,
    );
    expect(stats).toMatchObject({
      open: 2,
      overdue: 1,
      dueIn7Days: 1,
      nextDueAt: at(5),
      completed30: 0,
      completedPastLimit: 1,
    });
  });
});

describe('the mock People repository', () => {
  it('requires a ten-character reason to read a resume, and records the read', async () => {
    useMockModeStore.setState({ mode: 'normal' });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const repo = createMockAdminPeopleRepo();
    const id = 'usr_7f3c2b1da91e';
    await expect(repo.readResume(id, 'res_a1', { reason: 'short', caseRef: '' })).rejects.toThrow();
    const content = await repo.readResume(id, 'res_a1', {
      reason: 'Ticket SUP-2231 export bug',
      caseRef: 'SUP-2231',
    });
    expect(content.sections.length).toBeGreaterThan(0);
    const user = await repo.getUser(id);
    expect(user.adminActions?.[0]).toMatchObject({ kind: 'content_read', note: 'ticket SUP-2231' });
    vi.useRealTimers();
  });

  it('suspends a user and puts them back on reset', async () => {
    const repo = createMockAdminPeopleRepo();
    await repo.suspendUser('usr_5b8e20c4d3f1', { reason: 'fraud', note: 'Radar', notify: true });
    const page = await repo.listUsers({ filter: 'suspended', q: '', sort: null, page: 1 });
    expect(page.rows.map((row) => row.name)).toContain('Sofia Rossi');
    resetAdminMocks();
    const after = await repo.listUsers({ filter: 'suspended', q: '', sort: null, page: 1 });
    expect(after.rows.map((row) => row.name)).not.toContain('Sofia Rossi');
  });

  it('keeps a suspension through a comp, and restores the comp on reactivating', async () => {
    useMockModeStore.setState({ mode: 'normal' });
    const repo = createMockAdminPeopleRepo();
    const id = 'usr_7f3c2b1da91e';
    await repo.suspendUser(id, { reason: 'abuse', note: 'Spam runs', notify: false });
    await repo.compPro(id, { months: 1, reason: 'goodwill' });
    expect((await repo.getUser(id)).status).toBe('suspended');
    await repo.reactivateUser(id, { reason: 'user_request', note: '' });
    const user = await repo.getUser(id);
    expect(user.status).toBe('comped');
    expect(user.adminActions?.slice(0, 3).map((action) => action.note)).toEqual([
      'User request',
      'goodwill',
      'Abuse: Spam runs',
    ]);
    resetAdminMocks();
  });

  it('records a staff reset as a security event and a deletion as an admin action', async () => {
    useMockModeStore.setState({ mode: 'normal' });
    const repo = createMockAdminPeopleRepo();
    const id = 'usr_7f3c2b1da91e';
    await repo.sendPasswordReset(id);
    await repo.deleteUser(id, { reason: 'User asked by email' });
    const user = await repo.getUser(id);
    expect(user.securityEvents[0]).toMatchObject({ result: 'admin', device: 'Requested by Ehsan' });
    expect(user.securityEventCount).toBe(6);
    expect(user.adminActions?.[0]).toMatchObject({
      kind: 'deletion_requested',
      note: 'User asked by email',
    });
    resetAdminMocks();
  });

  it('refuses to invite an email already on staff, and stores no last-active for an invite', async () => {
    useMockModeStore.setState({ mode: 'normal' });
    const repo = createMockAdminPeopleRepo();
    await expect(
      repo.inviteStaff({ name: 'Ana', email: 'ANA@nextkin.ai', role: 'support' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    const invited = await repo.inviteStaff({
      name: 'Nina P.',
      email: 'nina@nextkin.ai',
      role: 'support',
    });
    expect(invited.member.lastActiveAt).toBeNull();
    expect(invited.temporaryPassword).toMatch(/^\S{4}(-\S{4}){3}$/);
    resetAdminMocks();
  });

  it('counts nothing in empty mode', async () => {
    useMockModeStore.setState({ mode: 'empty' });
    const repo = createMockAdminPeopleRepo();
    expect(await repo.userStats()).toMatchObject({ total: 0, active30Delta: null });
    expect(await repo.deletionStats()).toMatchObject({
      open: 0,
      completed30: 0,
      averageDays: null,
    });
    useMockModeStore.setState({ mode: 'normal' });
  });
});

describe('the HTTP People repository', () => {
  const http = (answer: unknown) => {
    const request = vi.fn().mockResolvedValue(answer);
    return { client: { request } as unknown as HttpClient, request };
  };

  it('browses every account from the server, with any search length and the plan filters', async () => {
    const row = {
      id: 'u1',
      name: '',
      email: 'a@x.test',
      plan: 'pro',
      status: 'suspended',
      usage: { used: 4, limit: 100 },
      signedUpAt: '2026-01-01T00:00:00Z',
      lastActiveAt: null,
      resumes: 3,
    };
    const { client, request } = http({ rows: [row], matched: 1, page: 1, pages: 1 });
    const repo = createHttpAdminPeopleRepo(client);

    const found = await repo.listUsers({ filter: 'pro', q: ' a ', sort: null, page: 1 });
    expect(request).toHaveBeenCalledWith('/admin/people/users', {
      query: { filter: 'pro', q: 'a', sort: 'desc', page: 1 },
    });
    expect(found).toMatchObject({ served: true, matched: 1 });
    expect(found.rows[0]).toMatchObject({ name: 'a@x.test', plan: 'pro', resumes: 3 });
  });

  it('sends the reason with a resume read, and refuses a short one', async () => {
    const { client, request } = http({ summary: 'x' });
    const repo = createHttpAdminPeopleRepo(client);
    await expect(repo.readResume('u1', 'r1', { reason: 'short', caseRef: '' })).rejects.toThrow();
    await repo.readResume('u1', 'r1', { reason: 'Ticket 2231 export', caseRef: 'SUP-2231' });
    expect(request).toHaveBeenCalledWith('/admin/users/u1/resumes/r1', {
      query: { reason: 'Ticket 2231 export · SUP-2231' },
    });
  });
});
