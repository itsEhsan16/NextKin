import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren, ReactElement } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';
import {
  CertificationsListScreen,
  EducationListScreen,
  ExperienceListScreen,
  LinksListScreen,
  SkillsScreen,
} from '@/features/profile';
import { openExternalUrl } from '@/lib';

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

// Partial mock: the screens use `useReducedMotion`, `a11yButton` and `formatMonthYear` from the
// same barrel, so everything but the one call under test stays real.
jest.mock('@/lib', () => ({
  ...jest.requireActual('@/lib'),
  openExternalUrl: jest.fn(),
}));

const mockOpenUrl = openExternalUrl as jest.MockedFunction<typeof openExternalUrl>;

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Rows enter on `FadeInDown`; the Reanimated mock leaves an entering node at opacity 0. */
const shown = { includeHiddenElements: true } as const;

/** Mock repos resolve on (fake) timers: 300–900ms in normal mode. */
const settle = (ms = 2000) => act(() => jest.advanceTimersByTimeAsync(ms));

async function mount(page: ReactElement) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>{page}</QueryClientProvider>
    </SafeAreaProvider>,
  );
  await settle();
}

describe('Profile entry lists (V2 §7.3 — no artboard)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockPush.mockClear();
    mockBack.mockClear();
    mockOpenUrl.mockReset();
    mockOpenUrl.mockResolvedValue('done');
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('says where a role came from, and one tap makes it the person’s word', async () => {
    const { profile } = mockStore.state;
    mockStore.state.profile = {
      ...profile,
      experiences: profile.experiences.map((entry, index) => ({
        ...entry,
        provenance: index === 0 ? ('parsed_confirmed' as const) : ('user' as const),
      })),
    };
    await mount(<ExperienceListScreen />);

    expect(screen.getByText('From your resume', shown)).toBeOnTheScreen();
    // A confirmed row says nothing (toreview §148.1).
    expect(screen.queryByText('Confirmed', shown)).toBeNull();
    expect(screen.getAllByLabelText(/^Confirm /, shown)).toHaveLength(1);

    await act(async () => fireEvent.press(screen.getByLabelText(/^Confirm /, shown)));
    await settle();

    expect(screen.queryByText('From your resume', shown)).toBeNull();
    expect(screen.queryByLabelText(/^Confirm /, shown)).toBeNull();
    expect(mockStore.state.profile.experiences[0]?.provenance).toBe('user');
  });

  it('says nothing about the source of a row that has none', async () => {
    await mount(<ExperienceListScreen />);
    expect(screen.queryByText('Confirmed', shown)).toBeNull();
    expect(screen.queryByText('From your resume', shown)).toBeNull();
  });

  it('confirms the skills read from a resume together', async () => {
    mockStore.state.profile = { ...mockStore.state.profile, skillsToConfirm: ['Figma', 'Sketch'] };
    await mount(<SkillsScreen />);

    expect(screen.getByText('2 skills from your resume', shown)).toBeOnTheScreen();
    await act(async () =>
      fireEvent.press(screen.getByLabelText('Confirm the skills from your resume', shown)),
    );
    await settle();

    expect(screen.queryByText('2 skills from your resume', shown)).toBeNull();
    expect(mockStore.state.profile.skillsToConfirm).toBeUndefined();
  });

  it('lists the roles with their dates and opens the one that was pressed', async () => {
    await mount(<ExperienceListScreen />);

    expect(screen.getByRole('header', { name: 'Work experience' })).toBeOnTheScreen();

    // The regression this pass exists for. These titles were handed to `ListRow`'s trailing
    // `value` slot, which starved them to width 0 — "Senior UX Designer" rendered as "Senior U…"
    // and the education degree as nothing at all. Title and meta are separate lines now, so each
    // clamps on its own and neither can take the other's width.
    expect(screen.getByText('Senior UX Designer', shown)).toBeOnTheScreen();
    expect(screen.getByText('4 roles on your profile', shown)).toBeOnTheScreen();
    expect(screen.getByText('Flipkart', shown)).toBeOnTheScreen();
    expect(screen.getByText('Mar 2022 – Present', shown)).toBeOnTheScreen();
    // The role still held carries the board's Current pill (573:44).
    expect(screen.getByText('Current', shown)).toBeOnTheScreen();
    expect(screen.getByText('Product Designer', shown)).toBeOnTheScreen();
    expect(screen.getByText('Jun 2019 – Feb 2022', shown)).toBeOnTheScreen();

    // §7.3 makes per-role skill tags load-bearing (§7.7 validates against them); the list is now
    // where they can be checked without opening the form.
    expect(screen.getByText('Design systems', shown)).toBeOnTheScreen();
    expect(screen.getByText('Payments', shown)).toBeOnTheScreen();

    // One focus stop per entry, reading the whole row rather than each chip.
    await act(async () =>
      fireEvent.press(screen.getByLabelText(/^UX Designer, PhonePe, Aug 2017 – May 2019/, shown)),
    );
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/profile/experience/[id]',
      params: { id: 'exp_3' },
    });

    await act(async () => fireEvent.press(screen.getByLabelText('Add a role')));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/profile/experience/[id]',
      params: { id: 'new' },
    });
  }, 60000);

  it('labels education by degree and dates it from the institution', async () => {
    await mount(<EducationListScreen />);

    // The worst case of the starvation bug: this degree is the shortest title in the app and its
    // meta line the longest, so it rendered zero glyphs on a 390dp phone.
    expect(screen.getByText('M.Des.', shown)).toBeOnTheScreen();
    expect(screen.getByText('National Institute of Design', shown)).toBeOnTheScreen();
    expect(screen.getByText('Jul 2014 – May 2016', shown)).toBeOnTheScreen();
    expect(screen.getByText('Interaction Design', shown)).toBeOnTheScreen();

    await act(async () =>
      fireEvent.press(
        screen.getByLabelText(/^B\.E\., Anna University, Aug 2010 – May 2014/, shown),
      ),
    );
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/profile/education/[id]',
      params: { id: 'edu_2' },
    });
  }, 60000);

  it('offers Add exactly once when the list is empty', async () => {
    // The fixture profile has no certifications, so this list is empty as it stands.
    await mount(<CertificationsListScreen />);

    expect(screen.getByText('No certifications yet')).toBeOnTheScreen();
    expect(
      screen.getByText('Credentials you have earned back up the skills you list.', shown),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('AWS, Google, a course certificate — anything with an issuer counts.'),
    ).toBeOnTheScreen();

    // PROFILE 10 draws one Add, under the message; the list's dashed card is for a filled list.
    // One affordance, not two.
    const actions = screen.getAllByLabelText('Add a certification', shown);
    expect(actions).toHaveLength(1);

    await act(async () => fireEvent.press(actions[0] as NonNullable<(typeof actions)[0]>));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/profile/certifications/[id]',
      params: { id: 'new' },
    });
  }, 60000);

  it('gives a link two targets: the row edits it, the button opens it', async () => {
    await mount(<LinksListScreen />);

    expect(screen.getByLabelText('Portfolio, georgesmith.design', shown)).toBeOnTheScreen();
    expect(
      screen.getByLabelText('LinkedIn, linkedin.com/in/george-smith', shown),
    ).toBeOnTheScreen();
    // §6.2 — there is no LinkedIn import to offer, and the page says so.
    expect(
      screen.getByText('Paste the address yourself — LinkedIn has no import we can use.'),
    ).toBeOnTheScreen();

    await act(async () =>
      fireEvent.press(screen.getByLabelText('Portfolio, georgesmith.design', shown)),
    );
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/profile/links/[id]',
      params: { id: 'link_portfolio' },
    });

    await act(async () => fireEvent.press(screen.getByLabelText('Open Portfolio', shown)));
    expect(mockOpenUrl).toHaveBeenCalledWith('https://georgesmith.design');
  }, 60000);

  it('says so out loud when nothing on the device can open a link', async () => {
    mockOpenUrl.mockResolvedValue('unavailable');
    await mount(<LinksListScreen />);

    await act(async () => fireEvent.press(screen.getByLabelText('Open LinkedIn', shown)));
    await act(async () => {});

    expect(
      screen.getByText('Nothing on this device could open that link', shown),
    ).toBeOnTheScreen();
  }, 60000);
});
