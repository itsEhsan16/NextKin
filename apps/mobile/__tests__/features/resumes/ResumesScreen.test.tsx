import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';
import { ResumesScreen, useResumesStore } from '@/features/resumes';
import { storage } from '@/lib';

const mockPush = jest.fn();
const mockOpenCreate = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), back: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

// The screen only ever asks the create-sheet context to open; the sheet's own behaviour is
// CreateSheet.test.tsx's job. Spying at the hook seam keeps this suite off React commits that
// Reanimated's out-of-act layout callbacks can wedge late in a long walk.
jest.mock('@/navigation', () => {
  const actual = jest.requireActual('@/navigation');
  // Built per call: the factory runs before `mockOpenCreate` is initialised.
  const createSheet = () => ({
    progress: { value: 0 },
    isOpen: false,
    open: mockOpenCreate,
    close: jest.fn(),
    toggle: jest.fn(),
  });
  return {
    ...actual,
    useCreateSheet: createSheet,
    // useResumesActions reads the optional form: root-stack screens share it, outside the tabs.
    useOptionalCreateSheet: createSheet,
  };
});

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const INITIAL = useResumesStore.getState();

/**
 * ONE mount for the whole walk: repeated mount/unmount of screens with in-flight queries in a
 * single file wedges React's act queue and later renders silently commit empty trees (see the
 * test-infra note in the plan's Phase 3 status). The empty and error modes each get their own
 * file for the same reason.
 */
describe('ResumesScreen (RESUMES 01/02)', () => {
  beforeEach(() => {
    resetMockRepos();
    mockPush.mockClear();
    mockOpenCreate.mockClear();
    storage.remove('prefs.resumesView');
    useResumesStore.setState(INITIAL, true);
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
  });

  it('walks the grid, the routing, the menu, the list toggle and the filters', async () => {
    useMockModeStore.setState({ mode: 'normal' });
    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <ResumesScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );

    // — Grid chrome and the artboard copy (RESUMES 01) —
    expect(await screen.findByText('Product Designer', {}, { timeout: 10000 })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Resumes' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Search resumes and letters')).toHaveProp(
      'placeholder',
      'Search resumes and letters',
    );
    expect(screen.getByLabelText('All')).toBeSelected();
    expect(screen.getByLabelText('Cover Letters')).toBeOnTheScreen();
    expect(screen.getByLabelText('Sort by Last edited')).toBeOnTheScreen();

    // Usage meter (Figma 1:1388) from the subscription fixture.
    expect(
      await screen.findByText('2 of 2 free resumes used', {}, { timeout: 5000 }),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Upgrade')).toBeOnTheScreen();

    // The dashed tile leads the grid.
    expect(screen.getByLabelText('New')).toBeOnTheScreen();
    expect(screen.getByText('Resume or cover letter')).toBeOnTheScreen();

    // Artboard document set, plus Home's res_1 (known artboard inconsistency — see fixtures).
    for (const title of [
      'UX Designer Resume',
      'Stripe — Senior PD',
      'Razorpay UX',
      'Stripe cover letter',
      'Freshworks DS Lead',
      'Linear PD',
      'Zoho Product',
      'Atlassian Staff PD',
    ]) {
      expect(screen.getByText(title)).toBeOnTheScreen();
    }
    // The in-flight Canva generation belongs to Home's progress card, not the library.
    expect(screen.queryByText('Staff Product Designer — Canva')).toBeNull();

    // — The dashed "+ New" tile requests the same create sheet as the FAB —
    fireEvent.press(screen.getByLabelText('New'));
    expect(mockOpenCreate).toHaveBeenCalledTimes(1);

    // Card metadata. The pills are decorative — their copy travels in the card's accessibility
    // label — so they are hidden from the tree.
    const hidden = { includeHiddenElements: true } as const;
    expect(screen.getByText('Base', hidden)).toBeOnTheScreen();
    expect(screen.getByText('Tailored · Stripe', hidden)).toBeOnTheScreen();
    expect(screen.getByText('Cover letter', hidden)).toBeOnTheScreen();
    expect(screen.getAllByText('Update available', hidden)).toHaveLength(2);
    expect(screen.getAllByText('Edited 2d ago').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Edited 1mo ago')).toHaveLength(2);
    // Every scored document wears its engine score (C-10); the base resume has no JD, so no
    // total and no chip (D-15).
    expect(screen.getAllByLabelText(/^ATS score \d+$/)).toHaveLength(7);

    // — Routing: the ATS chip opens the score panel; the card itself opens the editor —
    const res1 = mockStore.state.atsScores.res_1?.total;
    fireEvent.press(screen.getByLabelText(`ATS score ${res1}`));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/resumes/[id]/score',
      params: { id: 'res_1' },
    });
    mockPush.mockClear();
    // Phase 9C: every document opens its editor, scored or not — the panel is a view OF the
    // document, reached from the editor's own meta strip.
    fireEvent.press(screen.getByLabelText(/^Zoho Product,/));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/resumes/[id]',
      params: { id: 'res_zoho' },
    });

    // — The ⋯ control hands the document to the menu store (RESUMES 03's host) —
    fireEvent.press(screen.getByLabelText('More actions for Product Designer'));
    expect(useResumesStore.getState().menuOpen).toBe(true);
    expect(useResumesStore.getState().menuResume?.id).toBe('res_base');
    await act(async () => useResumesStore.getState().closeMenu());

    // — List layout (RESUMES 02): subtitles appear and the choice persists —
    fireEvent.press(screen.getByLabelText('List view'));
    expect(await screen.findByText('Base resume · 3 pages · PDF and DOCX ready')).toBeOnTheScreen();
    expect(screen.getByText('Tailored · Razorpay · Senior UX Designer')).toBeOnTheScreen();
    expect(screen.getByText('New resume or cover letter')).toBeOnTheScreen();
    expect(storage.get('prefs.resumesView')).toBe('list');

    // — Type pills and search, with a way back from a dead end —
    fireEvent.press(screen.getByLabelText('Cover Letters'));
    await waitFor(() => expect(screen.queryByText('Product Designer')).toBeNull());
    expect(screen.getByText('Stripe cover letter')).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('All'));
    await screen.findByText('Product Designer');

    fireEvent.changeText(screen.getByLabelText('Search resumes and letters'), 'zoho');
    await waitFor(() => expect(screen.queryByText('Product Designer')).toBeNull());
    expect(screen.getByText('Zoho Product')).toBeOnTheScreen();

    fireEvent.changeText(screen.getByLabelText('Search resumes and letters'), 'xyzzy');
    expect(await screen.findByText('No documents match')).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('Clear search'));
    expect(await screen.findByText('Product Designer')).toBeOnTheScreen();

    // — The list layout's "+ New" row is the same affordance —
    fireEvent.press(screen.getByLabelText('New resume or cover letter'));
    expect(mockOpenCreate).toHaveBeenCalledTimes(2);
  }, 60000);
});
