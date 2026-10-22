import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren, ReactElement } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import type { Profile } from '@/data/models';
import { createQueryClient, qk } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { DesiredRolesScreen, LocationsScreen, SkillsScreen } from '@/features/profile';

const mockBack = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
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

/** Entry chips enter on `FadeIn`; the Reanimated mock leaves an entering node at opacity 0. */
const shown = { includeHiddenElements: true } as const;

/** Mock repos resolve on (fake) timers: 300–900ms in normal mode. */
const settle = (ms = 3000) => act(() => jest.advanceTimersByTimeAsync(ms));

async function mount(element: ReactElement) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>
    </SafeAreaProvider>,
  );
  return queryClient;
}

const profileOf = (queryClient: QueryClient) => queryClient.getQueryData<Profile>(qk.profile.me());

const type = async (label: string, value: string) =>
  act(async () => fireEvent.changeText(screen.getByLabelText(label), value));

const press = async (label: string) =>
  act(async () => fireEvent.press(screen.getByLabelText(label, shown)));

describe('the profile chip screens (V2 §7.3 — no artboard)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
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

  it('loads the skills, refuses a duplicate out loud, and writes a new one through', async () => {
    const queryClient = await mount(<SkillsScreen />);

    // The bar is pinned while loading: it owns the bottom safe-area inset, so the viewport must
    // not change size when the list lands.
    expect(screen.getByLabelText('Save changes')).toBeDisabled();

    await settle();

    expect(screen.getByLabelText('Figma, skill', shown)).toBeOnTheScreen();
    expect(screen.getByText('12 skills on your profile')).toBeOnTheScreen();
    expect(screen.getByLabelText('Save changes')).toBeDisabled();

    await type('Add a skill', '  figma ');
    await press('Add');

    expect(screen.getByText('Figma is already on your list.')).toBeOnTheScreen();
    expect(screen.getByText('12 skills on your profile')).toBeOnTheScreen();
    // A refusal is not an edit: there is still nothing to save.
    expect(screen.getByLabelText('Save changes')).toBeDisabled();

    await type('Add a skill', 'Service design');
    await press('Add');

    expect(screen.getByText('13 skills on your profile')).toBeOnTheScreen();
    expect(screen.getByLabelText('Save changes')).not.toBeDisabled();

    await press('Save changes');
    await settle();

    expect(profileOf(queryClient)?.skills).toContain('Service design');
    expect(mockBack).toHaveBeenCalledTimes(1);
  }, 60000);

  it('asks before dropping unsaved skills when back is pressed', async () => {
    await mount(<SkillsScreen />);
    await settle();

    await press('Figma, skill');
    expect(screen.getByText('11 skills on your profile')).toBeOnTheScreen();

    await press('Back');
    expect(screen.getByText('Discard changes?')).toBeOnTheScreen();
    expect(mockBack).not.toHaveBeenCalled();

    await press('Discard');
    expect(mockBack).toHaveBeenCalledTimes(1);
  }, 60000);

  it('stops desired roles at five and says so on the field itself', async () => {
    await mount(<DesiredRolesScreen />);
    await settle();

    // The same wording the Profile tab's row uses against MAX_DESIRED_ROLES.
    expect(screen.getByText('3 of 5 roles added')).toBeOnTheScreen();

    await type('Add a desired role', 'Product Designer');
    await press('Add');
    expect(screen.getByText('4 of 5 roles added')).toBeOnTheScreen();

    await type('Add a desired role', 'UX Researcher');
    await press('Add');
    expect(screen.getByText('5 of 5 roles added')).toBeOnTheScreen();

    // §13.5: the cap is on screen before it refuses anything, and the field goes inert.
    expect(screen.getByLabelText('Add a desired role')).toBeDisabled();
    expect(screen.getByText('5 of 5 — remove one to add another')).toBeOnTheScreen();
    expect(screen.getByLabelText('Add')).toBeDisabled();
  }, 60000);

  it('writes the locations and the remote preference in one save', async () => {
    const queryClient = await mount(<LocationsScreen />);
    await settle();

    expect(screen.getByLabelText('Bengaluru, location', shown)).toBeOnTheScreen();
    expect(screen.getByText('1 location on your profile')).toBeOnTheScreen();
    expect(
      screen.getByText('Only used for matching — never shown on your resume.'),
    ).toBeOnTheScreen();

    await type('Add a location', 'Pune');
    await press('Add');
    expect(screen.getByText('2 locations on your profile')).toBeOnTheScreen();

    await press('Hybrid, remote preference');

    await press('Save changes');
    await settle();

    expect(profileOf(queryClient)?.preferences.locations).toEqual(['Bengaluru', 'Pune']);
    expect(profileOf(queryClient)?.preferences.remote).toBe('hybrid');
    expect(mockBack).toHaveBeenCalledTimes(1);
  }, 60000);
});
