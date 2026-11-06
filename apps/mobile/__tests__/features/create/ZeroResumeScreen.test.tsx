import { useSetupAnswers } from '@/features/create/setupAnswers';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { subscriptionFixture, useMockModeStore } from '@/data/mock';
import type { Generation, Subscription } from '@/data/models';
import { createQueryClient, qk } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { ZeroResumeScreen } from '@/features/create';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    navigate: jest.fn(),
    back: mockBack,
    replace: mockReplace,
  }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Free plan with the month's three generations already spent (V2 §13.5's paywall state). */
const spentSubscription: Subscription = {
  ...subscriptionFixture,
  usage: { ...subscriptionFixture.usage, generationsUsed: 3, generationsLimit: 3 },
};
const freshSubscription: Subscription = {
  ...subscriptionFixture,
  usage: { ...subscriptionFixture.usage, generationsUsed: 2, generationsLimit: 3 },
};

/** Cards enter on `FadeInDown`; the Reanimated mock leaves an entering node at opacity 0. */
const shown = { includeHiddenElements: true } as const;
const settle = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));
const NORMAL_MS = 1000;
const START_MS = 2000;

async function renderZero(jobId?: string, seed?: (client: QueryClient) => void) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  seed?.(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <ZeroResumeScreen jobId={jobId} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  return queryClient;
}

const fresh = (client: QueryClient) =>
  client.setQueryData(qk.user.subscription(), freshSubscription);

describe('ZeroResumeScreen (ZERO 01, 613:206)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    [mockPush, mockBack, mockReplace].forEach((fn) => fn.mockClear());
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const press = (label: string) =>
    act(async () => fireEvent.press(screen.getByLabelText(label)));

  it('asks one thing at a time, starting with the name (§175)', async () => {
    await renderZero(undefined, fresh);
    // The bar is pinned while loading too — it owns the bottom safe-area inset.
    expect(screen.getByLabelText('Continue')).toBeDisabled();
    await settle(NORMAL_MS);

    expect(screen.getByLabelText('Step 1 of 3')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: /What’s your name\?/ })).toBeOnTheScreen();
    // The fixture user is George Smith; the field stays editable, it is just filled in.
    expect(screen.getByLabelText('Full name', shown).props.value).toBe('George Smith');
    // The other questions wait for their own screens.
    expect(screen.queryByRole('radio', { name: 'None yet' })).toBeNull();
    expect(screen.queryByLabelText('Role you want', shown)).toBeNull();
  });

  it('walks name → experience → role, then starts the run with the seed', async () => {
    const client = await renderZero(undefined, fresh);
    await settle(NORMAL_MS);

    await press('Continue');
    expect(screen.getByLabelText('Step 2 of 3')).toBeOnTheScreen();
    // Continue with no band picked says what is missing.
    await press('Continue');
    expect(
      screen.getByText('Pick how long you have worked. None is a fine answer.', shown),
    ).toBeOnTheScreen();
    // A tapped band moves on by itself.
    await act(async () => fireEvent.press(screen.getByRole('radio', { name: '6–10 years' })));
    await settle(400);
    expect(screen.getByLabelText('Step 3 of 3')).toBeOnTheScreen();
    expect(screen.getByText('1 of 3 generations left this month')).toBeOnTheScreen();

    await press('Write my draft');
    expect(screen.getByText('Add the role you want, like Product Designer.', shown)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    await act(async () => fireEvent.press(screen.getByText('Product Designer', shown)));
    await press('Write my draft');
    await settle(START_MS);

    const started = client.getQueryData<Generation>(qk.generations.active());
    expect(started?.kind).toBe('zero_resume');
    expect(started?.zero).toEqual({
      fullName: 'George Smith',
      yearsBand: '6-10',
      yearsExperience: 8,
      targetTitle: 'Product Designer',
    });
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/generations/[id]',
      params: { id: started?.id },
    });
  });

  it('keeps sign-up answers, so a known answer is one tap, and Back steps back', async () => {
    useSetupAnswers.getState().save({ role: 'Product Designer', years: '3-5' });
    await renderZero(undefined, fresh);
    await settle(NORMAL_MS);

    await press('Continue');
    expect(screen.getByRole('radio', { name: '3–5 years' })).toBeSelected();
    await press('Continue');
    expect(screen.getByLabelText('Role you want', shown).props.value).toBe('Product Designer');
    await press('Go back');
    expect(screen.getByLabelText('Step 2 of 3')).toBeOnTheScreen();
    useSetupAnswers.getState().reset();
  });

  it('starts from the job when opened from one (ZERO 00b)', async () => {
    const client = await renderZero('job_stripe', fresh);
    await settle(NORMAL_MS);
    await settle(NORMAL_MS);

    await press('Continue');
    await act(async () => fireEvent.press(screen.getByRole('radio', { name: 'None yet' })));
    await settle(400);
    expect(screen.getByLabelText('Role you want', shown).props.value).toBe(
      'Senior Product Designer',
    );
    await press('Write my draft');
    await settle(START_MS);

    expect(client.getQueryData<Generation>(qk.generations.active())?.jobId).toBe('job_stripe');
  });

  it('replaces the button with the plans once the month is spent', async () => {
    await renderZero(undefined, (client) =>
      client.setQueryData(qk.user.subscription(), spentSubscription),
    );
    await settle(NORMAL_MS);

    expect(screen.queryByLabelText('Write my draft')).toBeNull();
    await act(async () => fireEvent.press(screen.getByLabelText('See Pro plans')));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/upgrade',
      params: { reason: 'generations' },
    });
  });
});
