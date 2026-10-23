import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import type { EditableSectionKey, ResumeContent } from '@/data/models';
import { createQueryClient, qk } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { SectionEditorScreen, useResumesStore } from '@/features/resumes';

const mockPush = jest.fn();
const mockBack = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    navigate: jest.fn(),
    back: mockBack,
    replace: jest.fn(),
  }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Chips enter on `FadeIn`; the Reanimated mock leaves an entering node at opacity 0. */
const shown = { includeHiddenElements: true } as const;

/** Mock repos resolve on (fake) timers: 300–900ms in normal mode. */
const settle = (ms = 3000) => act(() => jest.advanceTimersByTimeAsync(ms));

const NEW_SUMMARY = 'Eight years of product design, measured in what shipped and what it changed.';

async function renderSection(id: string, section?: EditableSectionKey) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <SectionEditorScreen id={id} section={section} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  return queryClient;
}

describe('SectionEditorScreen (V2 §7.11 / §7.10 — no artboard)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockPush.mockClear();
    mockBack.mockClear();
    useResumesStore.setState({ toast: null, toastSurface: 'tabs' });
  });

  afterEach(async () => {
    // Flush in-flight mock requests BEFORE unmounting, so a late React Query update does not
    // open an act() scope that overlaps the next test's.
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('loads the summary, holds Save until it changes, and writes it through', async () => {
    const queryClient = await renderSection('res_base', 'summary');

    // The bar is pinned while loading: it owns the bottom safe-area inset, so the viewport must
    // not change size when the body lands.
    expect(screen.getByLabelText('Save')).toBeDisabled();

    await settle();

    expect(screen.getByRole('header', { name: 'Professional summary' })).toBeOnTheScreen();
    const field = screen.getByLabelText('Professional summary');
    expect(field.props.value).toContain('Senior UX designer with eight years across Flipkart');
    // Nothing has changed yet, so there is nothing to save.
    expect(screen.getByLabelText('Save')).toBeDisabled();

    await act(async () => fireEvent.changeText(field, NEW_SUMMARY));
    expect(screen.getByLabelText('Save')).not.toBeDisabled();

    await act(async () => fireEvent.press(screen.getByLabelText('Save')));
    await settle();

    const content = queryClient.getQueryData<ResumeContent>(qk.resumes.content('res_base'));
    expect(content?.summary).toBe(NEW_SUMMARY);
    // res_base has no JD and so no score (D-15): the confirmation says only that it saved.
    expect(useResumesStore.getState().toast).toBe('Saved');
    expect(useResumesStore.getState().toastSurface).toBe('editor');
    expect(mockBack).toHaveBeenCalledTimes(1);
  }, 60000);

  it('asks before dropping unsaved edits when back is pressed', async () => {
    await renderSection('res_base', 'summary');
    await settle();

    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Professional summary'), 'Half a thought'),
    );

    await act(async () => fireEvent.press(screen.getByLabelText('Back')));
    expect(screen.getByText('Discard changes?')).toBeOnTheScreen();
    expect(mockBack).not.toHaveBeenCalled();

    await act(async () => fireEvent.press(screen.getByLabelText('Discard')));
    expect(mockBack).toHaveBeenCalledTimes(1);
  }, 60000);

  it('refuses a duplicate skill out loud rather than dropping it', async () => {
    await renderSection('res_base', 'skills');
    await settle();

    expect(screen.getByLabelText('Figma, skill', shown)).toBeOnTheScreen();
    expect(screen.getByText('12 skills')).toBeOnTheScreen();

    await act(async () => fireEvent.changeText(screen.getByLabelText('Add a skill'), '  figma '));
    await act(async () => fireEvent.press(screen.getByLabelText('Add')));

    expect(screen.getByText('figma is already in this list.')).toBeOnTheScreen();
    expect(screen.getByText('12 skills')).toBeOnTheScreen();
    // A refusal is not an edit: there is still nothing to save.
    expect(screen.getByLabelText('Save')).toBeDisabled();
  }, 60000);

  it('says so when the route names a section this document does not have', async () => {
    await renderSection('res_base', undefined);

    expect(screen.getByText("That section isn't part of this document")).toBeOnTheScreen();
    expect(screen.queryByLabelText('Save')).toBeNull();

    await act(async () => fireEvent.press(screen.getByLabelText('Back to the document')));
    expect(mockBack).toHaveBeenCalledTimes(1);
  }, 60000);

  it('says the same when a resume section is asked of a cover letter', async () => {
    await renderSection('res_cover_stripe', 'experience');
    await settle();

    expect(screen.getByText("That section isn't part of this document")).toBeOnTheScreen();
  }, 60000);
});
