import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { legalFixture, useMockModeStore } from '@/data/mock';
import type { LegalDocKey } from '@/data/models';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { formatShortDate, openExternalUrl } from '@/lib';
import { LegalScreen } from '@/features/support';
import { legalParagraphs } from '@/features/support/components/LegalSections';

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

// Partial mock: @/lib is the barrel every screen imports, so only the one side effect is
// replaced and the formatters, a11y helpers and reduced-motion hook stay real.
jest.mock('@/lib', () => ({
  ...jest.requireActual('@/lib'),
  openExternalUrl: jest.fn(),
}));

const openMock = openExternalUrl as jest.MockedFunction<typeof openExternalUrl>;

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function renderLegal(doc?: LegalDocKey) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <LegalScreen doc={doc} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

/** Mock repos resolve on (fake) timers: a single read settles well inside 900ms. */
const settle = () => act(() => jest.advanceTimersByTimeAsync(1000));

describe('LegalScreen (V2 §8.5 — the documents, readable in-product)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockPush.mockClear();
    mockBack.mockClear();
    openMock.mockReset();
    openMock.mockResolvedValue('done');
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('renders the terms, its stamp and its paragraphs, and opens the web copy', async () => {
    await renderLegal('terms');

    // The shape of the page is blocked out while it loads, never a spinner.
    expect(screen.getByLabelText('Loading document')).toBeOnTheScreen();

    await settle();

    const terms = legalFixture.terms;
    expect(screen.getByRole('header', { name: 'Terms of service' })).toBeOnTheScreen();
    expect(screen.getByText(terms.intro, { includeHiddenElements: true })).toBeOnTheScreen();

    // — At least two section headings, each an accessibility header of its own —
    const headings = ['What NextKin does', 'Your content stays yours'];
    for (const heading of headings) {
      expect(
        screen.getByRole('header', { name: heading, includeHiddenElements: true }),
      ).toBeOnTheScreen();
    }

    // — §8.5's "Last updated" line, formatted, not the raw ISO stamp —
    const stamp = `Last updated ${formatShortDate(terms.updatedAt)}`;
    expect(stamp).not.toContain('T');
    expect(screen.getByText(stamp)).toBeOnTheScreen();
    expect(JSON.stringify(screen.toJSON())).not.toContain(terms.updatedAt);

    // — A body carrying a blank line becomes more than one paragraph, not one run-on block —
    const split = terms.sections.find((section) => section.body.includes('\n\n'));
    expect(split).toBeDefined();
    const paragraphs = legalParagraphs(split?.body ?? '');
    expect(paragraphs.length).toBeGreaterThan(1);
    for (const paragraph of paragraphs) {
      expect(screen.getByText(paragraph, { includeHiddenElements: true })).toBeOnTheScreen();
    }
    expect(screen.queryByText(split?.body ?? '', { includeHiddenElements: true })).toBeNull();

    // — The header's trailing action reaches the canonical copy —
    await act(async () => fireEvent.press(screen.getByLabelText('Open on the web')));
    expect(openMock).toHaveBeenCalledWith(terms.url);

    await act(async () => fireEvent.press(screen.getByLabelText('Back')));
    expect(mockBack).toHaveBeenCalledTimes(1);
  }, 60000);

  it('says so on the page when nothing on the device can open the web copy', async () => {
    openMock.mockResolvedValue('unavailable');
    await renderLegal('terms');
    await settle();

    await act(async () => fireEvent.press(screen.getByLabelText('Open on the web')));

    expect(screen.getByText('Nothing on this device could open the web copy.')).toBeOnTheScreen();
  }, 60000);

  it('publishes the privacy rights §8.5 names — GDPR and the Australian Privacy Act', async () => {
    await renderLegal('privacy');
    await settle();

    expect(screen.getByRole('header', { name: 'Privacy policy' })).toBeOnTheScreen();

    const rights = legalFixture.privacy.sections.find((section) => section.id === 'privacy_rights');
    expect(rights).toBeDefined();
    const paragraphs = legalParagraphs(rights?.body ?? '');
    const named = paragraphs.find((paragraph) => paragraph.includes('GDPR'));
    expect(named).toBeDefined();
    expect(named).toContain('Australian Privacy Act');
    expect(screen.getByText(named ?? '', { includeHiddenElements: true })).toBeOnTheScreen();
  }, 60000);

  it('renders a dead end rather than a document for a key that is not published', async () => {
    await renderLegal(undefined);

    expect(screen.getByText("That document doesn't exist")).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByLabelText('Go back')));
    expect(mockBack).toHaveBeenCalled();
  }, 60000);
});
