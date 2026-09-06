import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import type { Resume } from '@/data/models';
import { createQueryClient, qk } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { CREATE_RESUME_FOOTNOTE } from '@/features/create/createSteps';
import { NewResumeScreen } from '@/features/resumes';
import { CreateSheetProvider } from '@/navigation';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    navigate: jest.fn(),
    back: mockBack,
    replace: mockReplace,
  }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Mock repos resolve on (fake) timers: 300–900ms in normal mode. */
const settle = (ms = 2000) => act(() => jest.advanceTimersByTimeAsync(ms));

async function renderNewResume() {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        {/* useResumesActions reaches for the create sheet, which every resumes surface hosts. */}
        <CreateSheetProvider>
          <NewResumeScreen />
        </CreateSheetProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  return queryClient;
}

describe('NewResumeScreen (V2 §7.11 — no artboard)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockBack.mockClear();
    mockReplace.mockClear();
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

  it('starts empty, says why a blank name goes nowhere, and creates nothing', async () => {
    await renderNewResume();

    expect(screen.getByLabelText('Resume name').props.value).toBe('');
    // The template promise the create sheet makes is repeated here, not reworded.
    expect(screen.getByText(CREATE_RESUME_FOOTNOTE)).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByLabelText('Create')));
    await settle();

    expect(screen.getByText('Give it a name.')).toBeOnTheScreen();
    expect(mockReplace).not.toHaveBeenCalled();

    // Typing clears the refusal rather than leaving it standing over a fixed field.
    await act(async () => fireEvent.changeText(screen.getByLabelText('Resume name'), 'P'));
    expect(screen.queryByText('Give it a name.')).toBeNull();
  }, 60000);

  it('creates the document under the trimmed name and replaces to its editor', async () => {
    const queryClient = await renderNewResume();

    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Resume name'), '  Product Designer — 2026 '),
    );
    await act(async () => fireEvent.press(screen.getByLabelText('Create')));
    await settle();

    expect(mockReplace).toHaveBeenCalledTimes(1);
    const target = mockReplace.mock.calls[0]?.[0] as {
      pathname: string;
      params: { id: string };
    };
    expect(target.pathname).toBe('/resumes/[id]');

    // Replace, not push: the document exists, so the form must not stay on the back stack.
    expect(mockBack).not.toHaveBeenCalled();

    const created = queryClient.getQueryData<Resume>(qk.resumes.detail(target.params.id));
    expect(created?.title).toBe('Product Designer — 2026');
    expect(created?.docType).toBe('resume');
  }, 60000);

  it('submits from the keyboard the same way the bar does', async () => {
    await renderNewResume();

    const field = screen.getByLabelText('Resume name');
    await act(async () => fireEvent.changeText(field, 'Backend CV'));
    await act(async () => fireEvent(field, 'submitEditing'));
    await settle();

    expect(mockReplace).toHaveBeenCalledTimes(1);
  }, 60000);

  it('takes the header chevron back without creating anything', async () => {
    await renderNewResume();

    await act(async () => fireEvent.press(screen.getByLabelText('Back')));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  }, 60000);
});
