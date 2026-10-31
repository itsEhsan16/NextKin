import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { ResumeEditorScreen, useResumesStore } from '@/features/resumes';
import { CreateSheetProvider } from '@/navigation';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
const mockBack = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    navigate: mockNavigate,
    back: mockBack,
    replace: jest.fn(),
  }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/**
 * Every section card enters on `FadeInDown`, and the Reanimated mock leaves an entering node at
 * opacity 0 — which the queries read as hidden. The cards are on screen; they are simply mid
 * animation, so every assertion about a card passes this.
 */
const shown = { includeHiddenElements: true } as const;

const INITIAL = useResumesStore.getState();

/**
 * Mock repos resolve on (fake) timers: 300–900ms each in normal mode. The body and the score are
 * only requested once the document has landed, so the clock is advanced in steps rather than in
 * one jump — the second pair of requests is not scheduled until the first render has run.
 */
const settle = async (steps = 4) => {
  for (let step = 0; step < steps; step += 1) {
    await act(() => jest.advanceTimersByTimeAsync(1000));
  }
};

/**
 * On the phone the editor is a root-stack screen, above the tabs' `CreateSheetProvider`;
 * `withCreateSheet: false` mounts it that way.
 */
async function renderEditor(id: string, { withCreateSheet = true } = {}) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  const editor = <ResumeEditorScreen id={id} />;
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        {withCreateSheet ? <CreateSheetProvider>{editor}</CreateSheetProvider> : editor}
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe('ResumeEditorScreen (V2 §7.11 — no artboard)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    useResumesStore.setState(INITIAL, true);
    mockPush.mockClear();
    mockNavigate.mockClear();
    mockBack.mockClear();
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

  it('renders the base resume, routes a section edit, and opens the export sheet', async () => {
    await renderEditor('res_base');

    // The bar is pinned while loading too — it owns the bottom safe-area inset, so the viewport
    // must not change size when the document lands.
    expect(screen.getByLabelText('Loading document')).toBeOnTheScreen();
    expect(screen.getByLabelText('Download')).toBeDisabled();

    await settle();

    // — Header and meta strip —
    expect(screen.getByRole('header', { name: 'Product Designer' })).toBeOnTheScreen();
    // The base resume is written for no job: no JD, so no total and no ring (D-15).
    expect(screen.queryByLabelText(/^ATS score \d+$/)).toBeNull();
    expect(screen.getByText('v5 · edited 2 days ago')).toBeOnTheScreen();

    // — One card per §7.11 section, in RESUME_SECTION_ORDER, with the fixture's own copy —
    expect(
      screen.getByRole('header', { name: 'Professional summary', ...shown }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Senior UX designer with eight years across Flipkart, Swiggy and PhonePe. Builds design ' +
          'systems and payment flows used by millions of shoppers in India, and measures what ' +
          'they change.',
        shown,
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Skills', ...shown })).toBeOnTheScreen();
    expect(screen.getByText('Design systems', shown)).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Experience', ...shown })).toBeOnTheScreen();
    expect(screen.getByText('Senior UX Designer', shown)).toBeOnTheScreen();
    expect(screen.getByText('Flipkart · Mar 2022 — Present', shown)).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Rebuilt the address and payment step for 40M+ monthly shoppers, cutting drop-off 18%',
        shown,
      ),
    ).toBeOnTheScreen();
    // Four roles, two shown: the rest sit behind the disclosure.
    expect(screen.getByLabelText('Show 2 more roles', shown)).toBeOnTheScreen();
    expect(screen.getByText('Kirana POS kit', shown)).toBeOnTheScreen();
    expect(screen.getByText('M.Des. Interaction Design', shown)).toBeOnTheScreen();

    // The empty section keeps its card and offers the dashed tile instead of a blank body.
    expect(screen.getByLabelText('Add certifications', shown)).toBeOnTheScreen();

    // — Every section carries both actions —
    expect(screen.getByLabelText('Edit Professional summary', shown)).toBeOnTheScreen();
    expect(screen.getByLabelText('Rewrite Professional summary with AI', shown)).toBeOnTheScreen();

    // — Nothing is assumed in this document, so §7.9's gate is open —
    expect(screen.getByLabelText('Download')).toBeEnabled();
    expect(screen.getByText('PDF is always free')).toBeOnTheScreen();
    // No JD, no total (D-15): the bar has no score to show.
    expect(screen.queryByLabelText(/^Score \d+$/)).toBeNull();

    // — The pen opens that one section on its own page (§7.11) —
    await act(async () => fireEvent.press(screen.getByLabelText('Edit Experience', shown)));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/resumes/[id]/edit/[section]',
      params: { id: 'res_base', section: 'experience' },
    });

    // — Download is a sheet, not a screen (§7.12), raised on the editor's own surface —
    await act(async () => fireEvent.press(screen.getByLabelText('Download')));
    expect(useResumesStore.getState().exportOpen).toBe(true);
    expect(useResumesStore.getState().exportSurface).toBe('editor');
    expect(useResumesStore.getState().exportResume?.id).toBe('res_base');
  }, 60000);

  it('holds the download until the assumed roles are confirmed (V2 §7.9)', async () => {
    await renderEditor('res_zoho');
    await settle();

    expect(screen.getByRole('header', { name: 'Zoho Product' })).toBeOnTheScreen();

    // The flag lives in the BODY here — res_zoho carries none on the document itself — so a gate
    // reading only `Resume.needsReview` would let this one through.
    expect(screen.getByLabelText('Download')).toBeDisabled();
    expect(
      screen.getByText('Confirm the roles we assumed before you download this.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('PDF is always free')).toBeNull();
  }, 60000);

  it('renders a cover letter as one letter card, with no resume sections', async () => {
    await renderEditor('res_cover_stripe');
    await settle();

    expect(screen.getByRole('header', { name: 'Stripe cover letter' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Letter', ...shown })).toBeOnTheScreen();
    expect(screen.getByText('Dear Hiring Manager,', shown)).toBeOnTheScreen();
    expect(
      screen.getByText(
        'I am writing to apply for the Senior Product Designer role at Stripe. Eight years of ' +
          'product design, the last three senior, all of it consumer.',
        shown,
      ),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Edit letter', shown)).toBeOnTheScreen();

    // §7.10's tone is shown read-only on the strip; the picker belongs to the letter flow.
    expect(screen.getByText('Professional')).toBeOnTheScreen();

    // A letter has no §7.11 sections, and it is never scored — the absence is stated, not drawn.
    expect(screen.queryByRole('header', { name: 'Experience', ...shown })).toBeNull();
    expect(screen.queryByRole('header', { name: 'Skills', ...shown })).toBeNull();
    expect(screen.getByText('Not scored yet')).toBeOnTheScreen();
    expect(screen.queryByLabelText('What this score measures')).toBeNull();
  }, 60000);

  // It used to throw on open there: `useResumesActions` demanded the create sheet (toreview §74.3).
  it('opens outside the create sheet provider, as the root stack mounts it', async () => {
    await renderEditor('res_base', { withCreateSheet: false });
    await settle();

    expect(screen.getByRole('header', { name: 'Product Designer' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Download')).toBeEnabled();
  }, 60000);
});
