import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';
import { EditProfileScreen } from '@/features/profile';

const mockPush = jest.fn();
const mockBack = jest.fn();
/** The guard's removal hook: records whether it is armed and the callback a swipe-back would hit. */
const mockPrevent: { armed: boolean; onBlocked?: (event: { repeat: () => void }) => void } = {
  armed: false,
};
const mockRepeat = jest.fn();
const mockRelease = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    navigate: jest.fn(),
    back: mockBack,
    replace: jest.fn(),
  }),
  Link: ({ children }: PropsWithChildren) => children,
  usePreventRemove: (armed: boolean, onBlocked: (event: { repeat: () => void }) => void) => {
    mockPrevent.armed = armed;
    mockPrevent.onBlocked = onBlocked;
    return mockRelease;
  },
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** The suggestion chips enter on `FadeIn`; the Reanimated mock leaves them at opacity 0. */
const shown = { includeHiddenElements: true } as const;

/** Mock repos resolve on (fake) timers: 300–900ms in normal mode. */
const settle = (ms = 3000) => act(() => jest.advanceTimersByTimeAsync(ms));

const NEW_HEADLINE = 'Staff Product Designer';

async function renderScreen() {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <EditProfileScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  return queryClient;
}

describe('EditProfileScreen (V2 §7.3 — no artboard)', () => {
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

  it('loads both aggregates, holds Save until something changes, and writes only the half that did', async () => {
    await renderScreen();

    // The bar is pinned while loading: it owns the bottom safe-area inset, so the viewport must
    // not change size when the fields land.
    expect(screen.getByLabelText('Save changes')).toBeDisabled();

    await settle();

    expect(screen.getByLabelText('First name').props.value).toBe('George');
    expect(screen.getByLabelText('Last name').props.value).toBe('Smith');
    expect(screen.getByLabelText('Headline').props.value).toBe('Senior UX Designer');
    expect(screen.getByPlaceholderText('City or region').props.value).toBe('Bengaluru');
    expect(screen.getByLabelText('Years of experience').props.value).toBe('8');
    // The account's address is read-only here; it leads to its own screen.
    expect(screen.getByLabelText('Email, george.smith@example.com')).toBeOnTheScreen();

    // Nothing has changed yet, so there is nothing to save.
    expect(screen.getByLabelText('Save changes')).toBeDisabled();

    // The user record as it stands. `patchUser` replaces the object, so an untouched account is
    // the very same reference afterwards.
    const accountBefore = mockStore.state.user;

    await act(async () => fireEvent.changeText(screen.getByLabelText('Headline'), NEW_HEADLINE));
    expect(screen.getByLabelText('Save changes')).not.toBeDisabled();

    await act(async () => fireEvent.press(screen.getByLabelText('Save changes')));
    await settle();

    expect(mockStore.state.profile.headline).toBe(NEW_HEADLINE);
    // The rest of the profile patch rides along unchanged.
    expect(mockStore.state.profile.location).toBe('Bengaluru');
    expect(mockStore.state.profile.yearsExperience).toBe(8);
    // The name never moved, so the user aggregate was never written.
    expect(mockStore.state.user).toBe(accountBefore);
    expect(mockBack).toHaveBeenCalledTimes(1);
  }, 60000);

  it('offers a matching city under the location field and fills it in', async () => {
    await renderScreen();
    await settle();

    await act(async () =>
      fireEvent.changeText(screen.getByPlaceholderText('City or region'), 'hyd'),
    );

    const suggestion = screen.getByLabelText('Use Hyderabad', shown);
    expect(suggestion).toBeOnTheScreen();
    expect(screen.queryByLabelText('Use Bengaluru', shown)).toBeNull();

    await act(async () => fireEvent.press(suggestion));

    expect(screen.getByPlaceholderText('City or region').props.value).toBe('Hyderabad');
    // The field now says the city, so there is nothing left to suggest.
    expect(screen.queryByLabelText('Use Hyderabad', shown)).toBeNull();
    expect(screen.getByLabelText('Save changes')).not.toBeDisabled();
  }, 60000);

  it('refuses an empty name out loud instead of saving it', async () => {
    await renderScreen();
    await settle();

    await act(async () => fireEvent.changeText(screen.getByLabelText('First name'), '  '));
    // Nothing is said on the first keystroke; the message arrives when the field is left.
    expect(screen.queryByText('Enter your first name.')).toBeNull();

    await act(async () => fireEvent(screen.getByLabelText('First name'), 'blur'));
    expect(screen.getByText('Enter your first name.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Save changes')).toBeDisabled();
  }, 60000);

  it('asks before dropping unsaved edits when back is pressed', async () => {
    await renderScreen();
    await settle();

    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Headline'), 'Half a thought'),
    );

    await act(async () => fireEvent.press(screen.getByLabelText('Back')));
    expect(screen.getByText('Discard changes?')).toBeOnTheScreen();
    expect(mockBack).not.toHaveBeenCalled();

    await act(async () => fireEvent.press(screen.getByLabelText('Discard')));
    expect(mockBack).toHaveBeenCalledTimes(1);
  }, 60000);

  it('asks on a swipe back too, and finishes that same swipe on Discard', async () => {
    await renderScreen();
    await settle();
    expect(mockPrevent.armed).toBe(false);

    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Headline'), 'Half a thought'),
    );
    expect(mockPrevent.armed).toBe(true);

    // What navigation does when the edge swipe or Android's back tries to remove the screen.
    await act(async () => mockPrevent.onBlocked?.({ repeat: mockRepeat }));
    expect(screen.getByText('Discard changes?')).toBeOnTheScreen();
    expect(mockRepeat).not.toHaveBeenCalled();

    await act(async () => fireEvent.press(screen.getByLabelText('Discard')));
    expect(mockRelease).toHaveBeenCalled();
    expect(mockRepeat).toHaveBeenCalledTimes(1);
    expect(mockBack).not.toHaveBeenCalled();
  }, 60000);
});
