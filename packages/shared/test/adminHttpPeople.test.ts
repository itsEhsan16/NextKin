import { describe, expect, it, vi } from 'vitest';

import { createHttpClient } from '../src/repos/http/client';
import { createHttpAdminPeopleRepo } from '../src/repos/http/adminPeopleRepo';
import { NotFoundError } from '../src/repos/state';

/**
 * The People area's HTTP repository against the server's real response shapes
 * (`packages/server/src/http/routes/admin.ts` and `adminPeople.ts`, `services/admin/users.ts`,
 * `services/admin/people*.ts`, `services/billing.ts`, `services/resumeRead.ts`). Synthetic records only.
 */

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const empty = () => new Response(null, { status: 204 });
/** `envelope()` in `server/src/http/errors.ts`. */
const failure = (status: number, code: string, message: string) =>
  json(status, { error: { code, message, details: null, request_id: 'req_1' } });

/** A server that answers `METHOD /path` (under /api/v1) from a table, and records each request. */
function server(routes: Record<string, () => Response> = {}) {
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const url = new URL(String(input));
    const answer = routes[`${init?.method ?? 'GET'} ${url.pathname.replace('/api/v1', '')}`];
    return answer ? answer() : failure(404, 'NOT_FOUND', 'That resource does not exist.');
  });
  const repo = createHttpAdminPeopleRepo(
    createHttpClient({ baseUrl: 'http://api.test', client: 'web', fetch }),
  );
  const requests = () =>
    fetch.mock.calls.map(([input, init]) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      return {
        url: new URL(String(input)),
        method: init?.method,
        contentType: headers['content-type'],
        body: init?.body === undefined ? undefined : (JSON.parse(String(init.body)) as unknown),
      };
    });
  return { repo, fetch, requests };
}

const ID = '7f3c2b1d-a91e-4c2b-8d3f-5e6a7b8c9d01';
const RESUME = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

/** `getSubscription`'s answer for a Pro account (`services/billing.ts`). */
const proSubscription = {
  plan: 'pro',
  status: 'active',
  renewsAt: '2026-12-02T10:00:00.000Z',
  planId: 'pro_monthly',
  cancelAtPeriodEnd: false,
  usage: {
    generationsUsed: 38,
    generationsLimit: 100,
    coverLettersUsed: 6,
    coverLettersLimit: 100,
    resumesUsed: 38,
    resumesLimit: 100,
    aiCreditsLeft: 62,
    atsChecksUsed: 21,
    atsChecksLimit: 30,
    assistantMessagesUsed: 4,
    assistantMessagesLimit: 100,
    interviewSetsUsed: 5,
    interviewSetsLimit: 100,
    resetsAt: '2026-12-01T00:00:00.000Z',
    assistantResetsAt: '2026-11-06T00:00:00.000Z',
  },
};

/** `inspectUser`: the account, its resume count, the subscription and the last 20 events. */
const inspected = (fields: Record<string, unknown> = {}) => ({
  id: ID,
  email: 'aarav.mehta@example.test',
  name: 'Aarav Mehta',
  status: 'active',
  role: 'user',
  emailVerified: true,
  createdAt: '2026-03-14T10:00:00.000Z',
  deletionRequestedAt: null,
  resumes: 12,
  subscription: proSubscription,
  securityEvents: [
    { kind: 'sign_in', at: '2026-11-05T09:30:00.000Z', ip: '102.89.10.20' },
    { kind: 'sign_in_failed', at: '2026-11-03T17:58:00.000Z', ip: '2001:db8:85a3::8a2e:370:7334' },
    { kind: 'password_reset', at: '2026-11-03T18:01:00.000Z', ip: null },
    { kind: 'sign_in', at: '2026-10-12T20:15:00.000Z', ip: '::ffff:41.58.3.4' },
    { kind: 'provider_linked', at: '2026-03-14T10:02:00.000Z', ip: '41.58.3.4' },
  ],
  ...fields,
});

/** `browseUsers`: one row with its facts (`services/admin/people.ts`); newest sign-up first. */
const browsed = (n: number, fields: Record<string, unknown> = {}) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  name: `User ${n}`,
  email: `user${n}@example.test`,
  plan: 'free',
  status: 'active',
  usage: { used: 1, limit: 3 },
  signedUpAt: new Date(Date.UTC(2026, 9, 30 - n)).toISOString(),
  lastActiveAt: '2026-11-04T12:00:00.000Z',
  resumes: 2,
  ...fields,
});

/** `userProfile`: `inspectUser` plus the detail page's facts (`services/admin/peopleDetail.ts`). */
const profile = (fields: Record<string, unknown> = {}) => ({
  ...inspected(),
  plan: 'pro',
  rowStatus: 'active',
  usageRow: { used: 38, limit: 100 },
  lastActiveAt: '2026-11-05T09:30:00.000Z',
  compedUntil: null,
  billing: {
    period: 'monthly',
    since: '2026-04-02T10:00:00.000Z',
    country: 'DE',
    priceMinor: 1200,
    currency: 'EUR',
    renewsAt: '2026-12-02T10:00:00.000Z',
    stripeCustomer: 'cus_Q2v7Lm8KfQ',
  },
  resumeList: [
    {
      id: RESUME,
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-11-02T10:00:00.000Z',
      pages: 2,
      template: 'Modern',
      source: 'Generated',
    },
    {
      id: 'r-2',
      createdAt: '2026-10-03T10:00:00.000Z',
      updatedAt: '2026-10-03T10:00:00.000Z',
      pages: null,
      template: null,
      source: 'Upload',
    },
  ],
  events: [
    {
      id: '41',
      kind: 'sign_in',
      at: '2026-11-05T09:30:00.000Z',
      ip: '102.89.10.20',
      device: 'Chrome on macOS',
    },
    {
      id: '40',
      kind: 'sign_in_failed',
      at: '2026-11-03T17:58:00.000Z',
      ip: '2001:db8:85a3::8a2e:370:7334',
      device: null,
    },
    {
      id: '39',
      kind: 'provider_linked',
      at: '2026-03-14T10:02:00.000Z',
      ip: '::ffff:41.58.3.4',
      device: 'Safari on iPhone',
    },
  ],
  securityEventCount: 57,
  adminActions: [
    {
      id: '901',
      kind: 'password_reset',
      label: 'Password reset email sent',
      by: 'Priya R.',
      note: null,
      at: '2026-11-03T18:01:00.000Z',
    },
  ],
  ...fields,
});

describe('userStats', () => {
  it('reads the Users page totals as the server counts them', async () => {
    const stats = {
      total: 120,
      newLast30: 14,
      active30: 61,
      active30Delta: null,
      pro: 9,
      proNew: 2,
      comped: 1,
      suspended: 3,
      suspendedBy: { abuse: 1, fraud: 1, other: 1 },
      pendingDeletion: 2,
      nextDeletionDueInDays: 26,
    };
    const { repo, requests } = server({ 'GET /admin/people/stats': () => json(200, stats) });
    await expect(repo.userStats()).resolves.toEqual(stats);
    expect(requests()[0]!.url.pathname).toBe('/api/v1/admin/people/stats');
  });
});

describe('listUsers', () => {
  const query = { filter: 'all' as const, q: '', sort: null, page: 1 };

  it('browses with no search, newest first, and maps each row with its facts', async () => {
    const { repo, requests } = server({
      'GET /admin/people/users': () =>
        json(200, {
          rows: [
            browsed(1, { plan: 'pro', usage: { used: 38, limit: 100 } }),
            // `deleteAccount` blanks the name and email and waits for the purge.
            browsed(2, {
              name: '',
              email: 'deleted+x@deleted.invalid',
              status: 'deletion_pending',
              lastActiveAt: null,
            }),
          ],
          matched: 41,
          page: 1,
          pages: 3,
        }),
    });
    const page = await repo.listUsers(query);
    expect(Object.fromEntries(requests()[0]!.url.searchParams)).toEqual({
      filter: 'all',
      q: '',
      sort: 'desc',
      page: '1',
    });
    expect(page).toMatchObject({ matched: 41, page: 1, pages: 3, served: true });
    expect(page.rows[0]).toEqual(browsed(1, { plan: 'pro', usage: { used: 38, limit: 100 } }));
    expect(page.rows[1]).toMatchObject({
      name: 'deleted+x@deleted.invalid',
      status: 'deletion_pending',
    });
  });

  it('sends a one-letter search, the plan filters, the sort and the page as asked', async () => {
    const { repo, requests } = server({
      'GET /admin/people/users': () => json(200, { rows: [], matched: 0, page: 2, pages: 2 }),
    });
    await repo.listUsers({ filter: 'pro', q: '  a ', sort: 'asc', page: 2 });
    await repo.listUsers({ ...query, filter: 'free' });
    const [first, second] = requests();
    expect(Object.fromEntries(first!.url.searchParams)).toEqual({
      filter: 'pro',
      q: 'a',
      sort: 'asc',
      page: '2',
    });
    expect(second!.url.searchParams.get('filter')).toBe('free');
  });
});

describe('getUser', () => {
  it('maps the plan, billing, resumes, devices, staff actions and masked events', async () => {
    const { repo, requests } = server({
      [`GET /admin/people/users/${ID}`]: () => json(200, profile()),
    });
    const user = await repo.getUser(ID);
    expect(requests()[0]!.url.pathname).toBe(`/api/v1/admin/people/users/${ID}`);

    expect(user).toMatchObject({
      id: ID,
      name: 'Aarav Mehta',
      plan: 'pro',
      status: 'active',
      emailVerified: true,
      resumes: 2,
      usage: { used: 38, limit: 100 },
      usageResetsAt: '2026-12-01T00:00:00.000Z',
      lastActiveAt: '2026-11-05T09:30:00.000Z',
      compedUntil: null,
      billing: {
        period: 'monthly',
        priceMinor: 1200,
        currency: 'EUR',
        stripeCustomer: 'cus_Q2v7Lm8KfQ',
      },
      // Held by the identity provider: no figure stands in for them.
      signInMethod: null,
      mfa: null,
      securityEventCount: 57,
    });
    expect(user.resumeList).toEqual(profile().resumeList);
    expect(user.adminActions).toEqual(profile().adminActions);
    // The interview figure is every set made against a per-resume cap, so it isn't a meter.
    expect(user.meters!.map((meter) => [meter.key, meter.used, meter.limit])).toEqual([
      ['generation', 38, 100],
      ['cover_letter', 6, 100],
      ['ats_check', 21, 30],
    ]);
    expect(user.securityEvents).toEqual([
      {
        id: '41',
        event: 'Signed in',
        result: 'success',
        ip: '102.89.xx.xx',
        device: 'Chrome on macOS',
        at: '2026-11-05T09:30:00.000Z',
      },
      {
        id: '40',
        event: 'Failed sign-in',
        result: 'failed',
        ip: '2001:db8:xx:xx',
        device: '—',
        at: '2026-11-03T17:58:00.000Z',
      },
      {
        id: '39',
        event: 'Provider linked',
        result: 'success',
        ip: '41.58.xx.xx',
        device: 'Safari on iPhone',
        at: '2026-03-14T10:02:00.000Z',
      },
    ]);
    // No address leaves unmasked.
    expect(JSON.stringify(user)).not.toMatch(/102\.89\.10|8a2e|41\.58\.3/);
  });

  it('reads a deleted account and a comp as the server labels them', async () => {
    const { repo } = server({
      [`GET /admin/people/users/${ID}`]: () =>
        json(
          200,
          profile({
            name: '',
            email: `deleted+${ID}@deleted.invalid`,
            status: 'deleted',
            rowStatus: 'deletion_pending',
            deletionRequestedAt: '2026-11-04T08:00:00.000Z',
            billing: null,
            resumeList: [],
            events: [],
            securityEventCount: 0,
            adminActions: [],
          }),
        ),
      'GET /admin/people/users/u-2': () =>
        json(
          200,
          profile({
            id: 'u-2',
            subscription: null,
            rowStatus: 'comped',
            compedUntil: '2027-01-05T00:00:00.000Z',
            billing: null,
          }),
        ),
    });

    expect(await repo.getUser(ID)).toMatchObject({
      status: 'deletion_pending',
      deletionRequestedAt: '2026-11-04T08:00:00.000Z',
      name: `deleted+${ID}@deleted.invalid`,
      resumeList: [],
      securityEvents: [],
      adminActions: [],
    });
    // With no subscription served, the meters aren't guessed.
    expect(await repo.getUser('u-2')).toMatchObject({
      status: 'comped',
      compedUntil: '2027-01-05T00:00:00.000Z',
      billing: null,
      meters: null,
      usageResetsAt: null,
    });
  });

  it('passes the server’s not-found on as a NotFoundError', async () => {
    const { repo } = server({
      'GET /admin/people/users/nope': () => failure(404, 'NOT_FOUND', 'That user does not exist.'),
    });
    const error = await repo.getUser('nope').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ message: 'That user does not exist.' });
  });
});

describe('the deletion queue', () => {
  const day = 86_400_000;
  const at = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();
  const ledger = [
    {
      id: 'd-1',
      userId: ID,
      origin: 'user',
      requestedAt: at(-2),
      dueAt: at(28),
      status: 'signed_out',
      completedAt: null,
    },
    {
      id: 'd-2',
      userId: 'u-2',
      origin: 'admin',
      requestedAt: at(-27),
      dueAt: at(3),
      status: 'purging',
      completedAt: null,
    },
    {
      id: 'd-3',
      userId: 'u-3',
      origin: 'user',
      requestedAt: at(-10),
      dueAt: at(20),
      status: 'completed',
      completedAt: at(-9),
    },
  ];

  it('lists the ledger with the filter and works the cards out from every request', async () => {
    const { repo, requests } = server({
      'GET /admin/people/deletions': () => json(200, { data: ledger }),
    });
    await expect(repo.listDeletions('open')).resolves.toEqual(ledger);
    expect(requests()[0]!.url.searchParams.get('filter')).toBe('open');

    const stats = await repo.deletionStats();
    expect(requests()[1]!.url.searchParams.get('filter')).toBe('all');
    expect(stats).toMatchObject({
      open: 2,
      overdue: 0,
      dueIn7Days: 1,
      nextDueAt: ledger[1]!.dueAt,
      completed30: 1,
      completedPastLimit: 0,
    });
  });

  it('starts a purge early with the trimmed reason', async () => {
    const { repo, requests } = server({
      'POST /admin/people/deletions/d-1/process': () => json(200, { status: 'purging' }),
    });
    await repo.processDeletion('d-1', { reason: '  user asked twice ' });
    expect(requests()[0]).toMatchObject({ method: 'POST', body: { reason: 'user asked twice' } });
  });
});

describe('account actions', () => {
  it('suspends and reactivates with a reason code, and a note only when there is one', async () => {
    const { repo, requests } = server({
      // `setUserStatus` answers with the status it set.
      [`POST /admin/users/${ID}/suspend`]: () => json(200, { status: 'suspended' }),
      [`POST /admin/users/${ID}/reactivate`]: () => json(200, { status: 'active' }),
    });
    // As the hooks call them (`useAdminPeople.ts`): with their own arguments, `id` included.
    const suspend = {
      id: ID,
      reason: 'fraud' as const,
      note: '  Radar flagged it  ',
      notify: true,
    };
    await repo.suspendUser(suspend.id, suspend);
    const reactivate = { id: ID, reason: 'user_request' as const, note: '   ' };
    await repo.reactivateUser(reactivate.id, reactivate);
    expect(
      requests().map(({ method, url, body }) => ({ method, path: url.pathname, body })),
    ).toEqual([
      {
        method: 'POST',
        path: `/api/v1/admin/users/${ID}/suspend`,
        // The route's body is strict: `notify` would be refused, so it isn't sent.
        body: { reason: 'fraud', note: 'Radar flagged it' },
      },
      {
        method: 'POST',
        path: `/api/v1/admin/users/${ID}/reactivate`,
        body: { reason: 'user_request' },
      },
    ]);
  });

  it('shows the server’s refusal, as when staff try to suspend themselves', async () => {
    const { repo } = server({
      [`POST /admin/users/${ID}/suspend`]: () =>
        failure(409, 'CONFLICT', 'You cannot change your own account’s status.'),
    });
    await expect(
      repo.suspendUser(ID, { reason: 'other', note: '', notify: false }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'You cannot change your own account’s status.',
    });
  });

  it('sends a password reset as a bodiless POST, answered 204', async () => {
    const { repo, requests } = server({ [`POST /admin/users/${ID}/password-reset`]: empty });
    await expect(repo.sendPasswordReset(ID)).resolves.toBeUndefined();
    expect(requests()[0]).toMatchObject({
      method: 'POST',
      body: undefined,
      contentType: undefined,
    });
  });

  it('comps Pro for whole months and returns the end date the server set', async () => {
    const { repo, requests } = server({
      // `grantComp`.
      [`POST /admin/users/${ID}/comp`]: () => json(200, { until: '2027-02-05T11:00:00.000Z' }),
    });
    // `useCompPro` passes its whole argument object; the route is `.strict()`, so an `id` in the
    // body would be a 400.
    const args = { id: ID, months: 3, reason: 'goodwill credit' };
    await expect(repo.compPro(args.id, args)).resolves.toEqual({
      until: '2027-02-05T11:00:00.000Z',
    });
    expect(requests()[0]!.method).toBe('POST');
    expect(requests()[0]!.body).toEqual({ months: 3, reason: 'goodwill credit' });
  });

  it('deletes with a reason, answered 204', async () => {
    const { repo, requests } = server({ [`POST /admin/users/${ID}/delete`]: empty });
    const args = { id: ID, reason: 'user asked by email' };
    await expect(repo.deleteUser(args.id, args)).resolves.toBeUndefined();
    expect(requests()[0]!.method).toBe('POST');
    expect(requests()[0]!.body).toEqual({ reason: 'user asked by email' });
  });

  it('sets a staff role with PUT /role', async () => {
    const { repo, requests } = server({
      [`PUT /admin/staff/${ID}/role`]: () => json(200, { role: 'curator', groups: ['curator'] }),
    });
    await repo.setStaffRole(ID, 'curator');
    expect(requests()[0]).toMatchObject({ method: 'PUT', body: { role: 'curator' } });
    expect(requests()[0]!.url.pathname).toBe(`/api/v1/admin/staff/${ID}/role`);
  });
});

describe('readResume', () => {
  const route = `GET /admin/users/${ID}/resumes/${RESUME}`;
  const input = { reason: 'Ticket 2231: export layout broken', caseRef: 'SUP-2231' };

  /** `readContent`: the current version's `DocumentContent`, with the account's contact line. */
  const resume = {
    kind: 'resume',
    resumeId: RESUME,
    versionId: '1c2d3e4f-0000-4000-8000-000000000003',
    header: {
      name: 'Aarav Mehta',
      items: [{ text: 'aarav@example.test' }, { text: '+49 151 0000000' }],
    },
    headline: 'Senior Software Engineer',
    contact: { email: 'aarav@example.test', phone: '+49 151 0000000', location: 'Berlin, Germany' },
    summary: 'Product-minded engineer with six years building data-heavy web apps.',
    skills: ['TypeScript', 'React', 'PostgreSQL'],
    experience: [
      {
        id: 'r1',
        company: 'Lumen Labs',
        title: 'Senior Engineer',
        period: 'Mar 2023 — Present',
        location: 'Berlin',
        start: '2023-03',
        end: null,
        skills: ['TypeScript'],
        bullets: ['Led the billing rewrite.', 'Cut the p95 page load by 40%.'],
      },
    ],
    projects: [
      { id: 'p1', name: 'Ledger', description: 'Open-source invoicing', bullets: ['500 stars'] },
    ],
    certifications: ['AWS Certified Developer'],
    education: [
      { id: 'e1', institution: 'TU Berlin', degree: 'MSc Computer Science', period: '2014 — 2016' },
    ],
    links: ['https://github.com/example'],
  };

  it('sends the reason and the case, and reads the document as its printed sections', async () => {
    const { repo, requests } = server({ [route]: () => json(200, resume) });
    const content = await repo.readResume(ID, RESUME, input);
    expect(requests()[0]!.method).toBe('GET');
    expect(requests()[0]!.url.searchParams.get('reason')).toBe(
      'Ticket 2231: export layout broken · SUP-2231',
    );
    expect(content).toEqual({
      resumeId: RESUME,
      title: 'Resume',
      sections: [
        { heading: 'Headline', lines: ['Senior Software Engineer'] },
        {
          heading: 'Professional summary',
          lines: ['Product-minded engineer with six years building data-heavy web apps.'],
        },
        { heading: 'Skills', lines: ['TypeScript, React, PostgreSQL'] },
        {
          heading: 'Work Experience',
          lines: [
            'Senior Engineer, Lumen Labs · Berlin · Mar 2023 — Present',
            '• Led the billing rewrite.',
            '• Cut the p95 page load by 40%.',
          ],
        },
        { heading: 'Projects', lines: ['Ledger: Open-source invoicing', '• 500 stars'] },
        { heading: 'Certifications', lines: ['AWS Certified Developer'] },
        { heading: 'Education', lines: ['MSc Computer Science · TU Berlin · 2014 — 2016'] },
        { heading: 'Links', lines: ['https://github.com/example'] },
      ],
    });
    // No internal ids, and no phone or location beyond what the page already shows.
    expect(JSON.stringify(content.sections)).not.toMatch(/1c2d3e4f|\+49|Germany|"r1"/);
  });

  it('reads a cover letter as its letter', async () => {
    const letter = {
      kind: 'cover_letter',
      resumeId: RESUME,
      versionId: '1c2d3e4f-0000-4000-8000-000000000004',
      tone: 'professional',
      greeting: 'Dear hiring team,',
      paragraphs: ['I build billing systems.', 'I would like to build yours.'],
      signoff: 'Best, Aarav',
    };
    const { repo } = server({ [route]: () => json(200, letter) });
    await expect(repo.readResume(ID, RESUME, input)).resolves.toEqual({
      resumeId: RESUME,
      title: 'Cover letter',
      sections: [
        {
          heading: 'Letter',
          lines: [
            'Dear hiring team,',
            'I build billing systems.',
            'I would like to build yours.',
            'Best, Aarav',
          ],
        },
      ],
    });
  });

  it('refuses a reason under ten characters before anything is read', async () => {
    const { repo, fetch } = server({ [route]: () => json(200, resume) });
    await expect(
      repo.readResume(ID, RESUME, { reason: ' too short ', caseRef: 'SUP-1' }),
    ).rejects.toThrow(/Say why/);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('Staff & roles (`/admin/staff*`)', () => {
  const MEMBER = {
    id: ID,
    name: 'Ana L.',
    email: 'ana@example.test',
    role: 'admin',
    mfa: 'none',
    lastActiveAt: null,
    status: 'invited',
  };

  it('lists staff, invites with a temporary password shown once, and resets a sign-in', async () => {
    const { repo, requests } = server({
      'GET /admin/staff': () => json(200, { data: [MEMBER] }),
      'POST /admin/staff': () =>
        json(201, { member: MEMBER, temporaryPassword: 'abcd-efgh-jkmn-pqrs', emailed: true }),
      [`POST /admin/staff/${ID}/reset`]: () =>
        json(200, { temporaryPassword: 'wxyz-2345-6789-abcd', emailed: false }),
    });
    expect(await repo.listStaff()).toEqual([MEMBER]);
    const invite = await repo.inviteStaff({
      name: ' Ana L. ',
      email: 'ana@example.test',
      role: 'admin',
    });
    expect(invite).toMatchObject({ member: { status: 'invited' }, emailed: true });
    expect(requests()[1]!.body).toEqual({ name: 'Ana L.', email: 'ana@example.test', role: 'admin' });
    expect(await repo.resetStaff(ID)).toEqual({
      temporaryPassword: 'wxyz-2345-6789-abcd',
      emailed: false,
    });
  });
});
