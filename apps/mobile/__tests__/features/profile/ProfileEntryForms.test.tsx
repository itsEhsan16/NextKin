import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren, ReactElement } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import type { Profile } from '@/data/models';
import { createQueryClient, qk } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
// Deep imports on purpose: the profile barrel pulls in every screen in the area, and the four
// forms under test must not fail because a neighbouring Phase 9F screen is mid-build.
import { CertificationFormScreen } from '@/features/profile/screens/CertificationFormScreen';
import { EducationFormScreen } from '@/features/profile/screens/EducationFormScreen';
import { ExperienceFormScreen } from '@/features/profile/screens/ExperienceFormScreen';
import { LinkFormScreen } from '@/features/profile/screens/LinkFormScreen';

const mockPush = jest.fn();
const mockBack = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), back: mockBack, replace: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Sheet bodies and chips enter animated; the Reanimated mock leaves them at opacity 0. */
const shown = { includeHiddenElements: true } as const;

/** Mock repos resolve on (fake) timers: 300–900ms in normal mode. */
const settle = (ms = 3000) => act(() => jest.advanceTimersByTimeAsync(ms));

async function renderForm(element: ReactElement) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>
    </SafeAreaProvider>,
  );
  return queryClient;
}

const profileIn = (client: QueryClient): Profile | undefined =>
  client.getQueryData<Profile>(qk.profile.me());

describe('Profile entry forms (V2 §7.3 — no artboard)', () => {
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

  it('holds Save on a new role until it has a company and a title, then writes it', async () => {
    const client = await renderForm(<ExperienceFormScreen id="new" />);

    // The bar is pinned while loading: it owns the bottom safe-area inset, so the viewport must
    // not change size when the profile lands.
    expect(screen.getByLabelText('Save')).toBeDisabled();
    await settle();

    expect(screen.getByRole('header', { name: 'Add role' })).toBeOnTheScreen();
    // Nothing has been typed, so there is nothing to save.
    expect(screen.getByLabelText('Save')).toBeDisabled();

    await act(async () => fireEvent.changeText(screen.getByLabelText('Company'), 'Acme Studio'));
    expect(screen.getByLabelText('Save')).toBeDisabled();

    await act(async () => fireEvent.changeText(screen.getByLabelText('Job title'), 'Design Lead'));
    expect(screen.getByLabelText('Save')).not.toBeDisabled();

    await act(async () => fireEvent.press(screen.getByLabelText('Save')));
    await settle();

    const roles = profileIn(client)?.experiences ?? [];
    const added = roles.find((role) => role.company === 'Acme Studio');
    expect(added?.title).toBe('Design Lead');
    // The repo minted the id; the screen sent an empty one.
    expect(added?.id.length).toBeGreaterThan(0);
    expect(mockBack).toHaveBeenCalledTimes(1);
  }, 60000);

  it('loads a role, hides its end date once it is current, and deletes it behind a confirm', async () => {
    const client = await renderForm(<ExperienceFormScreen id="exp_2" />);
    await settle();

    expect(screen.getByRole('header', { name: 'Edit role' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Company').props.value).toBe('Swiggy');
    expect(screen.getByLabelText('Job title').props.value).toBe('Product Designer');
    expect(screen.getByLabelText('Start, Jun 2019')).toBeOnTheScreen();
    expect(screen.getByLabelText('User research, skill', shown)).toBeOnTheScreen();

    // A role someone still holds reads Present, inert — the saved end date is hidden, not lost.
    expect(screen.getByLabelText('End, Feb 2022')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByLabelText('I currently work here')));
    expect(screen.queryByLabelText('End, Feb 2022')).not.toBeOnTheScreen();
    expect(screen.getByLabelText('End, Present')).toBeDisabled();
    // The editor names the role it is open on (PROFILE 05 573:152).
    expect(screen.getByText('Swiggy · Jun 2019 – Feb 2022')).toBeOnTheScreen();

    // Deleting lives on the entry, and asks first.
    await act(async () => fireEvent.press(screen.getByLabelText('Delete role')));
    expect(screen.getByText('Delete role?', shown)).toBeOnTheScreen();
    expect(profileIn(client)?.experiences.some((role) => role.id === 'exp_2')).toBe(true);

    await act(async () => fireEvent.press(screen.getByLabelText('Delete', shown)));
    await settle();

    expect(profileIn(client)?.experiences.some((role) => role.id === 'exp_2')).toBe(false);
    expect(mockBack).toHaveBeenCalledTimes(1);
  }, 60000);

  it('stores a typed bare address as an https one (V2 §7.3)', async () => {
    const client = await renderForm(<LinkFormScreen id="new" />);
    await settle();

    await act(async () => fireEvent.changeText(screen.getByLabelText('Name'), 'My LinkedIn'));
    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Web address'), 'linkedin.com/in/george'),
    );
    await act(async () => fireEvent.press(screen.getByLabelText('Save')));
    await settle();

    const added = (profileIn(client)?.links ?? []).find((link) => link.label === 'My LinkedIn');
    expect(added?.url).toBe('https://linkedin.com/in/george');
    expect(mockBack).toHaveBeenCalledTimes(1);
  }, 60000);

  it('says an entry is gone rather than opening an empty form over it', async () => {
    await renderForm(<ExperienceFormScreen id="exp_nope" />);
    await settle();

    expect(screen.getByText('That entry no longer exists')).toBeOnTheScreen();
    // Nothing to save, so the page carries no action bar at all.
    expect(screen.queryByLabelText(/^Save/)).not.toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByLabelText('Back to work experience')));
    expect(mockBack).toHaveBeenCalledTimes(1);
  }, 60000);

  it('explains an emptied field on blur and asks before dropping the edit', async () => {
    await renderForm(<EducationFormScreen id="edu_1" />);
    await settle();

    const field = screen.getByLabelText('School or university');
    expect(field.props.value).toBe('National Institute of Design');

    await act(async () => fireEvent.changeText(field, '   '));
    // Nothing yet — an error on the first keystroke reads as a telling-off.
    expect(screen.queryByText('Add the school or university.')).not.toBeOnTheScreen();

    await act(async () => fireEvent(field, 'blur'));
    expect(screen.getByText('Add the school or university.')).toBeOnTheScreen();
    // An existing entry saves with "Save changes" (577:7528); a new one with "Save".
    expect(screen.getByLabelText('Save changes')).toBeDisabled();

    await act(async () => fireEvent.press(screen.getByLabelText('Back')));
    expect(screen.getByText('Discard changes?', shown)).toBeOnTheScreen();
    expect(mockBack).not.toHaveBeenCalled();

    await act(async () => fireEvent.press(screen.getByLabelText('Discard', shown)));
    expect(mockBack).toHaveBeenCalledTimes(1);
  }, 60000);

  it('picks a month for a credential through the sheet rather than a typed date', async () => {
    await renderForm(<CertificationFormScreen id="new" />);
    await settle();

    expect(screen.getByLabelText('Issued, Not set')).toBeOnTheScreen();
    // An expiry is optional, and the row says so instead of guessing one (V2 §7.9).
    expect(screen.getByLabelText("Expires, Doesn't expire")).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByLabelText('Issued, Not set')));
    expect(screen.getByRole('header', { name: 'When was it issued?' })).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByLabelText('Mar', shown)));
    await act(async () => fireEvent.press(screen.getByLabelText('Done', shown)));

    const year = new Date().getFullYear();
    expect(screen.getByLabelText(`Issued, Mar ${year}`)).toBeOnTheScreen();
  }, 60000);
});
