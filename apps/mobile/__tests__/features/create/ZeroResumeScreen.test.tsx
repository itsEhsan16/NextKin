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

  it('asks three things under the About you step, with the quota on the bar', async () => {
    await renderZero(undefined, fresh);
    // The bar is pinned while loading too — it owns the bottom safe-area inset.
    expect(screen.getByLabelText('Write my draft')).toBeDisabled();
    await settle(NORMAL_MS);

    expect(screen.getByLabelText('Step 1 of 3')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Let’s write your first resume' })).toBeOnTheScreen();
    // The fixture user is George Smith; the field stays editable, it is just filled in.
    expect(screen.getByLabelText('Full name', shown).props.value).toBe('George Smith');
    expect(screen.getByRole('radio', { name: 'None yet' })).toBeOnTheScreen();
    expect(screen.getByText('1 of 3 generations left this month')).toBeOnTheScreen();
  });

  it('shows prefilled answers as a summary, with a tap to change them (§173)', async () => {
    useSetupAnswers.getState().save({ role: 'Product Designer', years: '3-5' });
    await renderZero(undefined, fresh);
    await settle(NORMAL_MS);

    expect(screen.getByLabelText('Name, George Smith. Edit')).toBeOnTheScreen();
    expect(screen.getByLabelText('Role you want, Product Designer. Edit')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByLabelText('Experience. Edit')));
    expect(screen.getByLabelText('Full name', shown).props.value).toBe('George Smith');
    useSetupAnswers.getState().reset();
  });

  it('says what is missing on a press, then starts the run with the seed', async () => {
    const client = await renderZero(undefined, fresh);
    await settle(NORMAL_MS);

    await act(async () => fireEvent.press(screen.getByLabelText('Write my draft')));
    expect(
      screen.getByText('Pick how long you have worked. None is a fine answer.', shown),
    ).toBeOnTheScreen();
    expect(screen.getByText('Add the role you want, like Product Designer.', shown)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();

    await act(async () => fireEvent.press(screen.getByRole('radio', { name: '6–10 years' })));
    expect(screen.getByRole('radio', { name: '6–10 years' })).toBeSelected();
    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Role you want', shown), 'Product Designer'),
    );
    await act(async () => fireEvent.press(screen.getByLabelText('Write my draft')));
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

  it('starts from the job when opened from one (ZERO 00b)', async () => {
    const client = await renderZero('job_stripe', fresh);
    await settle(NORMAL_MS);
    await settle(NORMAL_MS);

    expect(screen.getByLabelText('Role you want', shown).props.value).toBe(
      'Senior Product Designer',
    );
    await act(async () => fireEvent.press(screen.getByRole('radio', { name: 'None yet' })));
    await act(async () => fireEvent.press(screen.getByLabelText('Write my draft')));
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
