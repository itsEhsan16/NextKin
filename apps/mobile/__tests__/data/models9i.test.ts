import { activityFixture } from '@/data/mock';
import {
  ACTIVITY_FILTERS,
  ACTIVITY_KIND_ICON,
  ACTIVITY_KIND_LABEL,
  groupByAge,
  matchesActivityFilter,
  RESUME_SORT_LABEL,
  sortResumes,
  type ActivityKind,
  type Resume,
} from '@/data/models';

describe('activity filters (History)', () => {
  it('lands every kind in exactly one pill, so nothing can vanish from a filtered view', () => {
    const kinds = Object.keys(ACTIVITY_KIND_LABEL) as ActivityKind[];
    for (const kind of kinds) {
      const homes = ACTIVITY_FILTERS.filter((pill) => pill.kinds?.includes(kind));
      expect({ kind, homes: homes.map((pill) => pill.key) }).toEqual({
        kind,
        homes: [expect.any(String)],
      });
      expect(ACTIVITY_KIND_ICON[kind]).toEqual(expect.any(String));
    }
  });

  it('matches by group, and "all" matches everything', () => {
    const [entry] = activityFixture;
    if (!entry) throw new Error('fixture empty');
    expect(matchesActivityFilter(entry, 'all')).toBe(true);
    const matching = ACTIVITY_FILTERS.filter((pill) => matchesActivityFilter(entry, pill.key));
    expect(matching).toHaveLength(2);
  });
});

describe('groupByAge', () => {
  const now = new Date('2026-09-06T12:00:00.000Z');
  const at = (iso: string) => ({ id: iso, createdAt: iso });

  it('buckets by calendar day, then seven days, then earlier — and skips empty groups', () => {
    const rows = [
      at('2026-09-06T09:00:00.000Z'),
      at('2026-09-04T09:00:00.000Z'),
      at('2026-08-01T09:00:00.000Z'),
    ];
    const { items, stickyIndices } = groupByAge(rows, (row) => row.createdAt, now);
    expect(items.map((item) => (item.type === 'header' ? item.group : item.row.id))).toEqual([
      'today',
      '2026-09-06T09:00:00.000Z',
      'week',
      '2026-09-04T09:00:00.000Z',
      'earlier',
      '2026-08-01T09:00:00.000Z',
    ]);
    expect(stickyIndices).toEqual([0, 2, 4]);

    const onlyOld = groupByAge([at('2026-08-01T09:00:00.000Z')], (row) => row.createdAt, now);
    expect(onlyOld.items[0]).toEqual({ type: 'header', group: 'earlier' });
    expect(onlyOld.stickyIndices).toEqual([0]);
  });
});

describe('resume sort', () => {
  const doc = (id: string, over: Partial<Resume>): Resume => ({
    id,
    title: id,
    docType: 'resume',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    versionCount: 1,
    currentVersionId: 'v',
    status: 'ready',
    tags: [],
    ...over,
  });

  it('orders by each key, ties on the title, and puts unscored documents last under score', () => {
    const docs = [
      doc('b', {
        updatedAt: '2026-08-02T00:00:00.000Z',
        createdAt: '2026-07-01T00:00:00.000Z',
        atsScore: 70,
      }),
      doc('a', { updatedAt: '2026-08-02T00:00:00.000Z', createdAt: '2026-08-05T00:00:00.000Z' }),
      doc('c', {
        updatedAt: '2026-08-09T00:00:00.000Z',
        createdAt: '2026-08-03T00:00:00.000Z',
        atsScore: 92,
      }),
    ];
    expect(sortResumes(docs, 'edited').map((d) => d.id)).toEqual(['c', 'a', 'b']);
    expect(sortResumes(docs, 'created').map((d) => d.id)).toEqual(['a', 'c', 'b']);
    expect(sortResumes(docs, 'name').map((d) => d.id)).toEqual(['a', 'b', 'c']);
    expect(sortResumes(docs, 'score').map((d) => d.id)).toEqual(['c', 'b', 'a']);
    // The input is never mutated.
    expect(docs.map((d) => d.id)).toEqual(['b', 'a', 'c']);
    expect(RESUME_SORT_LABEL.edited).toBe('Last edited');
  });
});
