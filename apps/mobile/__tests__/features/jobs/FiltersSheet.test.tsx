import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FiltersSheetBody, useJobsStore } from '@/features/jobs';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const onClose = jest.fn();
const onApply = jest.fn();

const INITIAL = useJobsStore.getState();

/**
 * Wires the controlled body to the real store, which is where the group semantics live. No router
 * and no query client: the body takes callbacks and a count, so it must not reach for either —
 * their absence here is what enforces that.
 */
function Harness({ count, loading = false }: { count: number | undefined; loading?: boolean }) {
  const draft = useJobsStore((state) => state.draft);
  const store = useJobsStore.getState();
  if (!draft) return null;

  return (
    <FiltersSheetBody
      draft={draft}
      count={count}
      countLoading={loading}
      onClose={onClose}
      onApply={onApply}
      onReset={store.resetDraft}
      onPostedWithin={store.setDraftPostedWithin}
      onEmploymentType={store.toggleDraftEmploymentType}
      onRemote={store.toggleDraftRemote}
      onExperience={store.toggleDraftExperience}
      onSalary={store.setDraftSalary}
      onSort={store.setDraftSort}
    />
  );
}

const press = (label: string) =>
  act(async () => void fireEvent.press(screen.getByLabelText(label)));
const draftFilters = () => useJobsStore.getState().draft?.filters;

describe('Filters sheet (JOBS 04 — 1:760)', () => {
  beforeEach(() => {
    useJobsStore.setState(INITIAL, true);
    useJobsStore.getState().openFilters();
    onClose.mockClear();
    onApply.mockClear();
  });

  afterEach(async () => {
    await cleanup();
  });

  async function renderSheet(count: number | undefined = 128, loading = false) {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <Harness count={count} loading={loading} />
      </SafeAreaProvider>,
    );
  }

  it('renders every group with the artboard copy and the seeded selections', async () => {
    await renderSheet();

    ['Date posted', 'Job type', 'Workplace', 'Salary range', 'Experience level', 'Sort by'].forEach(
      (title) => expect(screen.getByRole('header', { name: title })).toBeOnTheScreen(),
    );
    ['Last 24h', 'Past week', 'Past month', 'Any time'].forEach((label) =>
      expect(screen.getByLabelText(label)).toBeOnTheScreen(),
    );
    ['Full-time', 'Part-time', 'Contract', 'Internship'].forEach((label) =>
      expect(screen.getByLabelText(label)).toBeOnTheScreen(),
    );
    ['Remote', 'Hybrid', 'On-site'].forEach((label) =>
      expect(screen.getByLabelText(label)).toBeOnTheScreen(),
    );
    ['Any', 'Entry', 'Mid-level', 'Senior', 'Lead'].forEach((label) =>
      expect(screen.getByLabelText(label)).toBeOnTheScreen(),
    );

    // The artboard opens on Any time / Full-time / Remote / Any.
    expect(screen.getByLabelText('Any time')).toBeSelected();
    expect(screen.getByLabelText('Full-time')).toBeSelected();
    expect(screen.getByLabelText('Remote')).toBeSelected();
    expect(screen.getByLabelText('Any')).toBeSelected();
    expect(screen.getByLabelText('Part-time')).not.toBeSelected();
  });

  it('treats Date posted as a single choice', async () => {
    await renderSheet();

    await press('Past week');
    expect(draftFilters()?.postedWithin).toBe('7d');
    expect(screen.getByLabelText('Any time')).not.toBeSelected();

    await press('Any time');
    expect(draftFilters()?.postedWithin).toBeUndefined();
  });

  it('accumulates Job type and Workplace picks', async () => {
    await renderSheet();

    await press('Contract');
    expect(draftFilters()?.employmentTypes).toEqual(['full_time', 'contract']);
    expect(screen.getByLabelText('Full-time')).toBeSelected();

    await press('On-site');
    expect(draftFilters()?.remote).toEqual(['remote', 'hybrid', 'onsite']);

    await press('Contract');
    expect(draftFilters()?.employmentTypes).toEqual(['full_time']);
  });

  it('lets "Any" clear the experience group', async () => {
    await renderSheet();

    await press('Senior');
    expect(draftFilters()?.experienceLevels).toEqual(['senior']);
    expect(screen.getByLabelText('Any')).not.toBeSelected();

    await press('Any');
    expect(draftFilters()?.experienceLevels).toEqual([]);
    expect(screen.getByLabelText('Any')).toBeSelected();
  });

  it('offers the two sorts the artboard draws and writes the picked one', async () => {
    await renderSheet();

    expect(screen.getByRole('tab', { name: 'Relevance' })).toBeSelected();
    await press('Date posted');
    expect(useJobsStore.getState().draft?.sort).toBe('recent');
  });

  it('previews the result count on the Apply button', async () => {
    await renderSheet(128);
    expect(screen.getByLabelText('Show 128 jobs')).toBeOnTheScreen();
  });

  it('disables Apply when nothing matches, and says so', async () => {
    await renderSheet(0);

    const apply = screen.getByLabelText('No jobs match');
    expect(apply).toBeOnTheScreen();
    expect(apply).toBeDisabled();
  });

  it('falls back to a plain label while the first count is still loading', async () => {
    await renderSheet(undefined, true);

    const apply = screen.getByLabelText('Apply filters');
    expect(apply).toHaveProp('accessibilityState', expect.objectContaining({ busy: true }));
  });

  it('resets every group without applying', async () => {
    await renderSheet();

    await press('Reset');
    expect(draftFilters()?.employmentTypes).toEqual([]);
    expect(draftFilters()?.remote).toEqual([]);
    expect(draftFilters()?.salaryMin).toBeUndefined();
    expect(screen.getByLabelText('Any time')).toBeSelected();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('reports Apply and Close to the host', async () => {
    await renderSheet();

    await press('Show 128 jobs');
    expect(onApply).toHaveBeenCalledTimes(1);

    await press('Close filters');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
