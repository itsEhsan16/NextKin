import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { UploadResumeScreen, useImportStore } from '@/features/create';
import { pickDocument } from '@/lib';

// A partial mock: everything else in the barrel — theme helpers, a11y, reduced motion — is the
// real thing, because `@/lib` is imported by half the tree this screen renders.
jest.mock('@/lib', () => ({
  ...jest.requireActual('@/lib'),
  pickDocument: jest.fn(),
}));

const pick = pickDocument as jest.MockedFunction<typeof pickDocument>;

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), back: mockBack, replace: mockReplace }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const FILE = { name: 'Aarav_Sharma_Resume.pdf', uri: 'file:///tmp/resume.pdf' };

/** The screen enters its cards on FadeInDown; the Reanimated mock leaves those at opacity 0. */
const shown = { includeHiddenElements: true } as const;

/** Mock repos resolve on (fake) timers: a parse takes 1200–2200ms, an error 600ms. */
const settle = (ms = 2500) => act(() => jest.advanceTimersByTimeAsync(ms));

async function renderUpload() {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <UploadResumeScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

const choose = async (label = 'Choose a file') =>
  act(async () => fireEvent.press(screen.getByLabelText(label)));

describe('UploadResumeScreen (V2 §7.4 — no artboard)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    pick.mockReset();
    mockPush.mockClear();
    mockBack.mockClear();
    mockReplace.mockClear();
    useImportStore.setState({ draft: null, resumeId: null });
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

  it('rests on the explanation and offers the picker', async () => {
    await renderUpload();

    expect(screen.getByRole('header', { name: 'Upload a resume' })).toBeOnTheScreen();
    expect(screen.getByText('What we can read', shown)).toBeOnTheScreen();
    ['PDF', 'DOCX', 'TXT'].forEach((format) => {
      expect(screen.getByText(format, shown)).toBeOnTheScreen();
    });
    // §7.4's promise, made before the file is picked rather than after it is parsed.
    expect(
      screen.getByText(/nothing reaches your profile until you say so/, shown),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Choose a file')).not.toBeDisabled();
  });

  it('treats a cancelled picker as nothing at all', async () => {
    pick.mockResolvedValue(null);
    await renderUpload();

    await choose();
    await settle();

    expect(pick).toHaveBeenCalledWith(['pdf', 'docx', 'txt']);
    expect(screen.getByLabelText('Choose a file')).not.toBeDisabled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(useImportStore.getState().draft).toBeNull();
  });

  it('parses a picked file, hands the draft over and replaces itself with the review', async () => {
    pick.mockResolvedValue(FILE);
    await renderUpload();

    await choose();

    // The wait has a shape: named ticks over a determinate bar, not a bare spinner.
    expect(screen.getByText(FILE.name)).toBeOnTheScreen();
    expect(screen.getByLabelText('Parsing, Reading the file')).toBeOnTheScreen();

    await settle();

    // The handover: the draft is not a query resource, so it travels in the import store while
    // the document — which is real, and already in the library — travels by id.
    const { draft, resumeId } = useImportStore.getState();
    expect(draft?.experiences?.length).toBeGreaterThan(0);
    expect(resumeId).toEqual(expect.any(String));

    // REPLACE, not push: back must not land on an upload that has already been spent.
    expect(mockReplace).toHaveBeenCalledWith('/create/upload-review');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('names the OCR cause when the parse fails, and keeps the picker live', async () => {
    useMockModeStore.setState({ mode: 'error' });
    pick.mockResolvedValue(FILE);
    await renderUpload();

    await choose();
    await settle();

    // §7.4's wording: an image-only scan is the common real cause, so the fix is named.
    expect(
      screen.getByText("We couldn't read that file — try a text-based PDF."),
    ).toBeOnTheScreen();
    expect(useImportStore.getState().draft).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();

    // Still pressable: a second pick is the retry, not a dead end.
    const retry = screen.getByLabelText('Choose another file');
    expect(retry).not.toBeDisabled();
    await act(async () => fireEvent.press(retry));
    expect(pick).toHaveBeenCalledTimes(2);
  });
});
