import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { Resume } from '@/data/models';
import { createQueryClient } from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';
import {
  AccuracyConfirmHost,
  ResumeExportHost,
  useAccuracyStore,
  useResumesStore,
} from '@/features/resumes';
import { renderPdf, shareFile, writeTextFile } from '@/lib';
import { CreateSheetProvider } from '@/navigation';

const mockPush = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), back: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

// The three device writers are the only things stubbed: everything else in @/lib (storage, a11y,
// reduced motion) is the real module, because the host and the sheet import it at module scope.
jest.mock('@/lib', () => ({
  ...jest.requireActual('@/lib'),
  renderPdf: jest.fn(),
  writeTextFile: jest.fn(),
  shareFile: jest.fn(),
}));

const mockRenderPdf = renderPdf as jest.MockedFunction<typeof renderPdf>;
const mockWriteTextFile = writeTextFile as jest.MockedFunction<typeof writeTextFile>;
const mockShareFile = shareFile as jest.MockedFunction<typeof shareFile>;

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Sheet rows and the toast all enter on a fade, which the Reanimated mock leaves at opacity 0. */
const hidden = { includeHiddenElements: true } as const;
const INITIAL = useResumesStore.getState();

const baseDoc = (): Resume => {
  const doc = mockStore.state.resumes.find((resume) => resume.id === 'res_base');
  if (!doc) throw new Error('fixture doc res_base missing');
  return doc;
};

function mount() {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <CreateSheetProvider>
          {/* The tabs mount and the editor's own copy, exactly as the app hosts them. */}
          <ResumeExportHost />
          <ResumeExportHost surface="editor" />
          {/* The root's accuracy confirmation (V2 §15 risk 2), as app/_layout mounts it. */}
          <AccuracyConfirmHost />
        </CreateSheetProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

const press = (label: string) =>
  act(async () => fireEvent.press(screen.getByLabelText(label, hidden)));

describe('ResumeExportHost (V2 §7.12 / §13.5 wiring)', () => {
  beforeEach(() => {
    resetMockRepos();
    mockPush.mockClear();
    useResumesStore.setState(INITIAL, true);
    useAccuracyStore.setState({ open: false, resolve: null });
    mockRenderPdf.mockReset().mockResolvedValue({ uri: 'file:///cache/doc.pdf', name: 'doc.pdf' });
    mockWriteTextFile
      .mockReset()
      .mockResolvedValue({ uri: 'file:///cache/doc.txt', name: 'doc.txt' });
    mockShareFile.mockReset().mockResolvedValue('done');
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
  });

  it('paints on one surface only, sells DOCX on free, and writes the PDF and the TXT', async () => {
    // No act(): nothing is mounted yet, and an un-awaited act scope would swallow the render.
    useResumesStore.getState().openExport(baseDoc());
    await mount();

    // — The pushed editor mount stays dark while the store says 'tabs': one paint, one scrim —
    expect(screen.getAllByLabelText('Export as PDF', hidden)).toHaveLength(1);
    expect(screen.getByLabelText(`Download ${baseDoc().title}`, hidden)).toBeOnTheScreen();

    // — The fixture plan is free, so the gate is painted before it is tapped (§13.5) —
    const locked = await screen.findByLabelText(
      'Export as DOCX, Pro feature',
      hidden,
      { timeout: 10000 }, // the plan arrives from useSubscription
    );
    expect(locked).toBeOnTheScreen();

    // — The first export of a version asks for the accuracy confirmation; "not yet" stops it —
    await press('Export as PDF');
    await waitFor(() => expect(useAccuracyStore.getState().open).toBe(true), { timeout: 10000 });
    await press('Not yet');
    await waitFor(() => expect(useAccuracyStore.getState().open).toBe(false), { timeout: 10000 });
    expect(mockRenderPdf).not.toHaveBeenCalled();
    expect(useResumesStore.getState().exportOpen).toBe(true);

    // — PDF: confirmed, rendered, then handed to the OS sheet; the sheet closes and confirms —
    await press('Export as PDF');
    await waitFor(() => expect(useAccuracyStore.getState().open).toBe(true), { timeout: 10000 });
    await press('Yes, it’s accurate');
    await waitFor(() => expect(mockRenderPdf).toHaveBeenCalledTimes(1), { timeout: 10000 });
    expect(mockRenderPdf.mock.calls[0]?.[1]).toMatch(/\.pdf$/);
    await waitFor(() => expect(mockShareFile).toHaveBeenCalledTimes(1), { timeout: 10000 });
    expect(mockShareFile.mock.calls[0]?.[1]).toMatchObject({ mimeType: 'application/pdf' });
    await waitFor(() => expect(useResumesStore.getState().exportOpen).toBe(false), {
      timeout: 10000,
    });
    expect(await screen.findByText('Saved as PDF', hidden, { timeout: 10000 })).toBeOnTheScreen();
    // Only the tabs mount hosts the toast — the editor's copy filters on toastSurface.
    expect(screen.getAllByText('Saved as PDF', hidden)).toHaveLength(1);
    await act(async () => useResumesStore.getState().hideToast());

    // — TXT: the same version is already confirmed, so it does not ask again —
    await act(async () => useResumesStore.getState().openExport(baseDoc()));
    await press('Export as TXT');
    await waitFor(() => expect(mockWriteTextFile).toHaveBeenCalledTimes(1), { timeout: 10000 });
    expect(mockWriteTextFile.mock.calls[0]?.[0]).toMatch(/\.txt$/);
    expect(await screen.findByText('Saved as text', hidden, { timeout: 10000 })).toBeOnTheScreen();
    expect(mockRenderPdf).toHaveBeenCalledTimes(1);
    await act(async () => useResumesStore.getState().hideToast());

    // — The locked row sells rather than exports: the sheet gets out of the way first —
    await act(async () => useResumesStore.getState().openExport(baseDoc()));
    await press('Export as DOCX, Pro feature');
    expect(useResumesStore.getState().exportOpen).toBe(false);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/upgrade',
      params: { reason: 'docx' },
    });
    expect(mockRenderPdf).toHaveBeenCalledTimes(1);
    expect(mockWriteTextFile).toHaveBeenCalledTimes(1);
  }, 60000);

  it('saves a Pro DOCX as plain text rather than handing over a broken .docx', async () => {
    // Expo Go has no DOCX renderer; §7.12 would rather be honest than ship an unopenable file.
    mockStore.state.subscription.plan = 'pro';
    useResumesStore.getState().openExport(baseDoc());
    await mount();

    await waitFor(
      () => expect(screen.queryByLabelText('Export as DOCX, Pro feature', hidden)).toBeNull(),
      { timeout: 10000 },
    );
    await press('Export as DOCX');
    await waitFor(() => expect(useAccuracyStore.getState().open).toBe(true), { timeout: 10000 });
    await act(async () => useAccuracyStore.getState().answer(true));

    await waitFor(() => expect(mockWriteTextFile).toHaveBeenCalledTimes(1), { timeout: 10000 });
    expect(mockWriteTextFile.mock.calls[0]?.[0]).toMatch(/\.txt$/);
    expect(mockShareFile.mock.calls[0]?.[1]).toMatchObject({ mimeType: 'text/plain' });
    expect(
      await screen.findByText("DOCX isn't ready on mobile yet — saved as plain text.", hidden, {
        timeout: 10000,
      }),
    ).toBeOnTheScreen();
    expect(mockRenderPdf).not.toHaveBeenCalled();
    await act(async () => useResumesStore.getState().hideToast());
  }, 60000);
});
