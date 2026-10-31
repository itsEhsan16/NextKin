import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { resetMockRepos } from '@/data/repos';
import { createAppQueryClient } from '@/data/savedResumes';
import { ResumeEditorScreen, useResumesStore } from '@/features/resumes';
import { CreateSheetProvider } from '@/navigation';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const INITIAL = useResumesStore.getState();
const COULD_NOT_LOAD = "Couldn't load this document";
const NOT_SAVED = 'Not saved on this phone yet';
const clients: QueryClient[] = [];

const settle = (ms = 4000) => act(() => jest.advanceTimersByTimeAsync(ms));

async function renderEditor() {
  const queryClient = createAppQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <CreateSheetProvider>
          <ResumeEditorScreen id="res_base" />
        </CreateSheetProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  return queryClient;
}

/** A saved copy stays readable; with nothing saved, the screen says what to do (toreview §145.5). */
describe('ResumeEditorScreen with no connection', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    useResumesStore.setState(INITIAL, true);
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    onlineManager.setOnline(true);
    jest.useRealTimers();
  });

  it('keeps the document on screen when its refresh fails', async () => {
    const client = await renderEditor();
    await settle();
    expect(screen.queryByText(COULD_NOT_LOAD)).toBeNull();
    const title = client.getQueryData<{ title: string }>(['resumes', 'detail', 'res_base'])?.title;
    expect(title).toBeTruthy();

    useMockModeStore.setState({ mode: 'error' });
    onlineManager.setOnline(false);
    await act(async () => {
      void client.refetchQueries({ queryKey: ['resumes'] });
    });
    await settle(8000);

    expect(screen.queryByText(COULD_NOT_LOAD)).toBeNull();
    expect(screen.queryByText(NOT_SAVED)).toBeNull();
    expect(client.getQueryData(['resumes', 'content', 'res_base'])).toBeDefined();
  });

  it('says a resume isn’t on this phone yet when it can’t be fetched', async () => {
    useMockModeStore.setState({ mode: 'error' });
    onlineManager.setOnline(false);
    await renderEditor();
    await settle(8000);

    expect(screen.getByText(NOT_SAVED)).toBeOnTheScreen();
    expect(
      screen.getByText('Open it once while you’re connected, and it’ll be here next time.', {
        includeHiddenElements: true,
      }),
    ).toBeOnTheScreen();
    expect(screen.queryByText(COULD_NOT_LOAD)).toBeNull();
  });
});
