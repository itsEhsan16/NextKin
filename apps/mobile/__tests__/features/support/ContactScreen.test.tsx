import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore, userFixture } from '@/data/mock';
import { SUPPORT_REPLY_WINDOW } from '@/data/models';
import { createQueryClient } from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';
import { ContactScreen } from '@/features/support';
import {
  CONTACT_MESSAGE_BLANK,
  CONTACT_MESSAGE_SHORT,
  CONTACT_SEND_FAILED,
} from '@/features/support/contactForm';

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

const MESSAGE = 'Exporting a PDF from the editor does nothing on my phone.';

async function renderContact(topic?: string) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <ContactScreen {...(topic ? { topic } : {})} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

/** Mock repos resolve on (fake) timers: the account read and the send both land well inside 1s. */
const settle = () => act(() => jest.advanceTimersByTimeAsync(1000));

const press = (label: string) =>
  act(
    async () => void fireEvent.press(screen.getByLabelText(label, { includeHiddenElements: true })),
  );

const type = (text: string) =>
  act(async () => void fireEvent.changeText(screen.getByTestId('contact-message'), text));

describe('ContactScreen (V2 §7.14 — no artboard)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockPush.mockClear();
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

  it('promises the reply window and shows the account address rather than asking for one', async () => {
    await renderContact();

    expect(screen.getByLabelText('Loading the contact form')).toBeOnTheScreen();
    // The bar is pinned while loading too — it owns the bottom safe-area inset, so the viewport
    // must not change size when the account lands.
    expect(screen.getByLabelText('Send')).toBeDisabled();

    await settle();

    expect(screen.getByRole('header', { name: 'Message support' })).toBeOnTheScreen();
    // The published window is said once, in the lede, from the model constant.
    expect(screen.getByText(new RegExp(SUPPORT_REPLY_WINDOW))).toBeOnTheScreen();
    expect(screen.getByText(userFixture.email)).toBeOnTheScreen();
    expect(screen.getByText('Change it in Account settings.')).toBeOnTheScreen();
  });

  it('refuses a message it cannot act on and says what is missing', async () => {
    await renderContact();
    await settle();

    // Nothing is said before the first keystroke.
    expect(screen.queryByText(CONTACT_MESSAGE_BLANK)).toBeNull();

    // The button is never inert: pressing it blank refuses the send and names the reason.
    await press('Send');
    expect(screen.getByText(CONTACT_MESSAGE_BLANK)).toBeOnTheScreen();

    await type('help');
    await press('Send');
    expect(screen.getByText(CONTACT_MESSAGE_SHORT)).toBeOnTheScreen();

    await settle();
    expect(mockStore.state.tickets).toHaveLength(0);
  });

  it('opens on the topic the help screen carried through, and changes it from the sheet', async () => {
    await renderContact('bug');
    await settle();

    expect(screen.getByLabelText('Topic, Something is broken')).toBeOnTheScreen();

    await press('Topic, Something is broken');
    expect(screen.getByRole('header', { name: 'What is this about?' })).toBeOnTheScreen();
    await press('Billing or my plan');

    expect(screen.getByLabelText('Topic, Billing or my plan')).toBeOnTheScreen();
  });

  it('ignores a topic the URL invented', async () => {
    await renderContact('refund');
    await settle();

    expect(screen.getByLabelText('Topic, A question')).toBeOnTheScreen();
  });

  it('sends the trimmed message against the account address and confirms before popping', async () => {
    await renderContact('billing');
    await settle();

    await type(`  ${MESSAGE}  `);
    await press('Send');
    await settle();

    const ticket = mockStore.state.tickets[0];
    expect(mockStore.state.tickets).toHaveLength(1);
    expect(ticket?.topic).toBe('billing');
    expect(ticket?.message).toBe(MESSAGE);
    // The form never asks for an address: the repo attaches the account's own.
    expect(ticket?.email).toBe(userFixture.email);

    // The confirmation is in-screen, because the toast host is not mounted above a pushed
    // screen — a Send that appears to do nothing is the failure mode this avoids.
    expect(screen.getByText('Message sent')).toBeOnTheScreen();
    expect(
      screen.getByText(new RegExp(userFixture.email), { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(mockBack).not.toHaveBeenCalled();

    await press('Done');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('keeps the message and the button live when the send fails', async () => {
    await renderContact();
    await settle();

    await type(MESSAGE);
    // Only the send fails: the account was read before the mode flipped, so this is the failure
    // path rather than the account-error state.
    useMockModeStore.setState({ mode: 'error' });
    await press('Send');
    await settle();

    // Nothing was sent, and the page says so instead of claiming a delivery it did not make.
    expect(mockStore.state.tickets).toHaveLength(0);
    expect(screen.getByText(CONTACT_SEND_FAILED)).toBeOnTheScreen();
    expect(screen.queryByText('Message sent')).toBeNull();
    expect(screen.getByTestId('contact-message')).toHaveProp('value', MESSAGE);

    // The button stays live, so pressing it again is the retry.
    expect(screen.getByLabelText('Send')).not.toBeDisabled();
    useMockModeStore.setState({ mode: 'normal' });
    await press('Send');
    await settle();

    expect(mockStore.state.tickets).toHaveLength(1);
    expect(screen.getByText('Message sent')).toBeOnTheScreen();
  });
});
