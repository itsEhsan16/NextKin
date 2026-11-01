import { describe, expect, it } from 'vitest';

import {
  applicationProgress,
  applicationProgressLine,
  followUpDue,
} from '../src/models/applicationProgress';
import type { ApplicationWithJob, Job } from '../src/models/job';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-11-01T12:00:00.000Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * DAY).toISOString();

const application = (days: number, status: ApplicationWithJob['application']['status'] = 'applied', checkedDays?: number) => ({
  status,
  appliedAt: daysAgo(days),
  ...(checkedDays === undefined ? {} : { checkedAt: daysAgo(checkedDays) }),
});

const row = (over: ReturnType<typeof application>): ApplicationWithJob => ({
  application: { id: 'a', jobId: 'j', ...over },
  job: {} as Job,
});

describe('followUpDue', () => {
  it('waits for the first week', () => {
    expect(followUpDue(application(6), now)).toBe(false);
    expect(followUpDue(application(7), now)).toBe(true);
  });

  it('counts a word since the point passed as the answer', () => {
    expect(followUpDue(application(10, 'applied', 1), now)).toBe(false);
    expect(followUpDue(application(10, 'applied', 5), now)).toBe(true);
  });

  it('asks again at three weeks, even after an answer at one', () => {
    expect(followUpDue(application(20, 'applied', 12), now)).toBe(false);
    expect(followUpDue(application(21, 'applied', 12), now)).toBe(true);
  });

  it('asks nothing about an application that has an answer', () => {
    for (const status of ['interview', 'offer', 'not_selected', 'withdrawn'] as const) {
      expect(followUpDue(application(30, status), now)).toBe(false);
    }
  });
});

describe('applicationProgressLine', () => {
  it('says what’s next', () => {
    const rows = [
      row(application(30)),
      row(application(8)),
      row(application(2)),
      row(application(12, 'interview')),
      row(application(40, 'not_selected')),
    ];
    expect(applicationProgressLine(applicationProgress(rows, now))).toBe(
      '5 applied · 1 interview · 2 to check on',
    );
  });

  it('leaves out a part at zero, and counts offers', () => {
    expect(applicationProgressLine({ applied: 1, interviews: 0, offers: 0, toCheck: 0 })).toBe('1 applied');
    expect(applicationProgressLine({ applied: 9, interviews: 2, offers: 1, toCheck: 0 })).toBe(
      '9 applied · 2 interviews · 1 offer',
    );
  });
});
