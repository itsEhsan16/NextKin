import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { resumesFixture } from '@/data/mock';
import { RESUME_SORT_LABEL, SCORE_LABEL, sortResumes, type Resume } from '@/data/models';
import { ResumeSortSheetHost, useResumesStore } from '@/features/resumes';
import { ResumesFilterBar } from '@/features/resumes/components/ResumesFilterBar';
import { RESUME_SORT_OPTIONS } from '@/features/resumes/resumeSortOptions';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const [seed] = resumesFixture;
if (!seed) throw new Error('resumesFixture is empty');

const doc = (id: string, over: Partial<Resume>): Resume => ({ ...seed, id, ...over });
const ids = (resumes: readonly Resume[]) => resumes.map((resume) => resume.id);

describe('resumeSortOptions (the library sort, RESUMES 01)', () => {
  it('offers the four sorts in the union order, leading with the default', () => {
    expect(RESUME_SORT_OPTIONS.map((option) => option.key)).toEqual([
      'edited',
      'created',
      'name',
      'score',
    ]);
    expect(RESUME_SORT_OPTIONS.map((option) => option.label)).toEqual([
      'Last edited',
      'Newest first',
      'Name',
      `Highest ${SCORE_LABEL}`,
    ]);
  });

  it('orders by the chosen key, ties on the title, and parks unscored documents last', () => {
    const docs = [
      doc('b', { title: 'Beta', updatedAt: '2026-08-01T00:00:00.000Z', atsScore: 70 }),
      doc('a', { title: 'Alpha', updatedAt: '2026-09-01T00:00:00.000Z', atsScore: undefined }),
      doc('c', { title: 'Gamma', updatedAt: '2026-08-20T00:00:00.000Z', atsScore: 91 }),
    ];

    expect(ids(sortResumes(docs, 'edited'))).toEqual(['a', 'c', 'b']);
    expect(ids(sortResumes(docs, 'name'))).toEqual(['a', 'b', 'c']);
    expect(ids(sortResumes(docs, 'score'))).toEqual(['c', 'b', 'a']);
    // Pure: the input list is not reordered under the caller.
    expect(ids(docs)).toEqual(['b', 'a', 'c']);
  });
});

const INITIAL = useResumesStore.getState();

const press = (label: string) =>
  act(
    async () => void fireEvent.press(screen.getByLabelText(label, { includeHiddenElements: true })),
  );

const shows = (label: string) =>
  screen.queryByLabelText(label, { includeHiddenElements: true }) !== null;

describe('ResumeSortSheetHost', () => {
  beforeEach(() => {
    useResumesStore.setState(INITIAL, true);
  });

  afterEach(async () => {
    await cleanup();
  });

  it('offers the four options and writes the picked one to the store', async () => {
    useResumesStore.setState({ sortOpen: true });
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ResumeSortSheetHost />
      </SafeAreaProvider>,
    );

    for (const option of RESUME_SORT_OPTIONS) expect(shows(option.label)).toBe(true);

    await press('Name');

    expect(useResumesStore.getState().sort).toBe('name');
    expect(useResumesStore.getState().sortOpen).toBe(false);
  });

  it('labels the library control with the sort in force, not a hardcoded default', async () => {
    const onPressSort = jest.fn();
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ResumesFilterBar
          typeFilter="all"
          onChangeTypeFilter={() => {}}
          subscription={undefined}
          sort="score"
          onPressSort={onPressSort}
          onPressUpgrade={() => {}}
        />
      </SafeAreaProvider>,
    );

    // The 9H defect on Saved jobs, fixed here too: the label follows the store.
    expect(shows('Sort by Last edited')).toBe(false);
    await press(`Sort by ${RESUME_SORT_LABEL.score}`);
    expect(onPressSort).toHaveBeenCalledTimes(1);
  });
});
