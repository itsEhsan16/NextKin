import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { adminFailuresFixture } from '../src/mock/fixtures/adminTrust';
import { useMockModeStore } from '../src/mock/mode';
import type { FailureQuery } from '../src/models/adminTrust';
import { resetAdminMocks } from '../src/repos/adminMockReset';
import { createMockAdminTrustRepo } from '../src/repos/adminTrustRepo';

/** Generation failures and abuse reports on the mock (Figma 406:1195, 407:946). Synthetic only. */

const settled = async <T>(promise: Promise<T>) => {
  await vi.runAllTimersAsync();
  return promise;
};

const ALL: FailureQuery = { status: 'all', search: '', kinds: [], page: 1 };

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  resetAdminMocks();
});

afterEach(() => {
  useMockModeStore.setState({ mode: 'normal' });
  vi.useRealTimers();
});

describe('the failure queue', () => {
  it('retries only open runs, and leaves resolved and retrying ones as they were', async () => {
    const repo = createMockAdminTrustRepo();
    const byStatus = (status: string) => adminFailuresFixture.find((row) => row.status === status)!;
    const ids = [byStatus('open').id, byStatus('resolved').id, byStatus('retrying').id];

    await settled(repo.retryFailures(ids));
    const page = await settled(repo.failures(ALL));
    expect(page!.counts).toMatchObject({ open: 6, retrying: 3, resolved: 452 });
  });

  it('says nothing is waiting once every run is closed', async () => {
    const repo = createMockAdminTrustRepo();
    for (const row of adminFailuresFixture.filter((r) => r.status === 'open'))
      await settled(repo.resolveFailure(row.id));
    const stats = await settled(repo.failureStats());
    expect(stats).toMatchObject({ open: 0, openNote: 'nothing waiting' });
  });

  it('serves empty counts in the empty mode, so the cards agree with the empty table', async () => {
    useMockModeStore.setState({ mode: 'empty' });
    const stats = await settled(createMockAdminTrustRepo().failureStats());
    expect(stats).toMatchObject({ failed30d: 0, open: 0, retriedOk: 0, mostCommon: null });
  });
});

describe('the report queue', () => {
  it('counts the board’s figures from the reports, and moves them when one is settled', async () => {
    const repo = createMockAdminTrustRepo();
    expect(await settled(repo.reportStats())).toMatchObject({
      open: 2,
      resolved30d: 14,
      resolvedNote: '9 dismissed · 4 links disabled · 1 suspension',
    });

    await settled(
      repo.actOnReport('RPT-1042', { action: 'disable_link', reason: 'spam', note: '' }),
    );
    expect(await settled(repo.reportStats())).toMatchObject({
      open: 1,
      resolved30d: 15,
      resolvedNote: '9 dismissed · 5 links disabled · 1 suspension',
    });
  });

  it('serves no figures in the empty mode', async () => {
    useMockModeStore.setState({ mode: 'empty' });
    const stats = await settled(createMockAdminTrustRepo().reportStats());
    expect(stats).toMatchObject({ open: 0, resolved30d: 0, medianResolveHours: null });
  });
});
