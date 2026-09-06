import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren, ReactElement } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import {
  CertificationsListScreen,
  EducationListScreen,
  ExperienceListScreen,
  LinksListScreen,
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

  it('lists the roles with their dates and opens the one that was pressed', async () => {
    await mount(<ExperienceListScreen />);

    expect(screen.getByRole('header', { name: 'Work experience' })).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Senior UX Designer, Flipkart · Mar 2022 – Present', shown),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Product Designer, Swiggy · Jun 2019 – Feb 2022', shown),
    ).toBeOnTheScreen();

    await act(async () =>
      fireEvent.press(screen.getByLabelText('UX Designer, PhonePe · Aug 2017 – May 2019', shown)),
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

    expect(
      screen.getByLabelText('M.Des., National Institute of Design · Jul 2014 – May 2016', shown),
    ).toBeOnTheScreen();

    await act(async () =>
      fireEvent.press(screen.getByLabelText('B.E., Anna University · Aug 2010 – May 2014', shown)),
    );
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/profile/education/[id]',
      params: { id: 'edu_2' },
    });
  }, 60000);

  it('offers the form from the empty state and keeps the Add bar beside it', async () => {
    // The fixture profile has no certifications, so this list is empty as it stands.
    await mount(<CertificationsListScreen />);

    expect(screen.getByText('No certifications yet')).toBeOnTheScreen();
    expect(
      // The message is hidden from the reader — StateView folds it into the title's label.
      screen.getByText('Credentials you have earned back up the skills you list.', shown),
    ).toBeOnTheScreen();

    // Two ways forward, and both reach the same form.
    const [emptyAction, stickyAction] = screen.getAllByLabelText('Add a certification');
    expect(stickyAction).toBeDefined();

    await act(async () => fireEvent.press(emptyAction as NonNullable<typeof emptyAction>));
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
