import { QueryClientProvider, useMutation, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { ConsentRequiredError, createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { AiConsentGate } from '@/features/consent/AiConsentGate';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const clients: QueryClient[] = [];
const settle = (ms = 3000) => act(() => jest.advanceTimersByTimeAsync(ms));

/** A screen whose AI press is refused once for want of consent, then succeeds. */
function Press({ run, onDone }: { run: () => Promise<string>; onDone: () => void }) {
  const mutation = useMutation({ mutationFn: run });
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => mutation.mutate(undefined, { onSuccess: onDone })}
    >
      <Text>Create</Text>
    </Pressable>
  );
}

describe('AiConsentGate (toreview §114: Agree and continue continues)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    jest.useRealTimers();
  });

  it('runs the refused action again after agreeing, with the screen’s own callback', async () => {
    const run = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(new ConsentRequiredError())
      .mockResolvedValue('ok');
    const onDone = jest.fn();
    const client = createQueryClient();
    clients.push(client);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={client}>
          <Press run={run} onDone={onDone} />
          <AiConsentGate />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
    await settle();

    await act(async () => fireEvent.press(screen.getByText('Create')));
    await settle();
    expect(screen.getByText('Before NextKin uses AI')).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByLabelText('Agree and continue')));
    await settle();
    expect(run).toHaveBeenCalledTimes(2);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
