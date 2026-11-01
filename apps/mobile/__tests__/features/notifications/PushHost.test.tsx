import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, render } from '@testing-library/react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import type { PropsWithChildren } from 'react';

import { forgetPushDevice, registerPushDevice } from '@/data/pushDevice';
import { createQueryClient } from '@/data/queries';
import { repos, resetMockRepos } from '@/data/repos';
import { PushHost } from '@/features/notifications';
import { pushTapOf, readPushToken, type TappedNotification } from '@/lib';

const mockNavigate = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: mockNavigate, back: jest.fn(), replace: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const permission = Notifications.getPermissionsAsync as jest.Mock;
const lastResponse = Notifications.getLastNotificationResponseAsync as jest.Mock;
const environment = Constants as { executionEnvironment?: string };

const allow = () => permission.mockResolvedValue({ granted: true, canAskAgain: false });

const tapOn = (data: Record<string, unknown>, where: 'android' | 'ios' | 'content' = 'android') =>
  ({
    notification: {
      request: {
        content: { data: where === 'content' ? data : {} },
        trigger:
          where === 'android'
            ? { remoteMessage: { data } }
            : where === 'ios'
              ? { payload: data }
              : null,
      },
    },
  }) as TappedNotification;

async function mount() {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <QueryClientProvider client={queryClient}>
      <PushHost />
    </QueryClientProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
}

describe('push on the phone (toreview §147.2)', () => {
  beforeEach(() => {
    resetMockRepos();
    mockNavigate.mockClear();
    jest.clearAllMocks();
    environment.executionEnvironment = ExecutionEnvironment.Standalone;
    permission.mockResolvedValue({ granted: false, canAskAgain: true });
    lastResponse.mockResolvedValue(null);
  });

  afterEach(async () => {
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    jest.restoreAllMocks();
  });

  it('reads a device token only with permission, and never in Expo Go', async () => {
    expect(await readPushToken()).toBeNull();
    allow();
    expect(await readPushToken()).toEqual({ platform: 'ios', token: 'test-token' });
    environment.executionEnvironment = ExecutionEnvironment.StoreClient;
    expect(await readPushToken()).toBeNull();
  });

  it('registers a phone that said yes, with its zone, and forgets it on sign-out', async () => {
    const register = jest.spyOn(repos.notifications, 'registerDevice').mockResolvedValue();
    const remove = jest.spyOn(repos.notifications, 'removeDevice').mockResolvedValue();
    allow();
    await registerPushDevice();
    expect(register).toHaveBeenCalledWith({
      platform: 'ios',
      token: 'test-token',
      timeZone: expect.any(String),
    });
    await forgetPushDevice();
    expect(remove).toHaveBeenCalledWith('test-token');
    await forgetPushDevice();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('registers nothing for a phone that hasn’t said yes', async () => {
    const register = jest.spyOn(repos.notifications, 'registerDevice').mockResolvedValue();
    await mount();
    expect(register).not.toHaveBeenCalled();
  });

  it('reads where a tap goes, from whichever service sent it', () => {
    const data = { url: '/applications/a', notificationId: 'n' };
    for (const where of ['android', 'ios', 'content'] as const) {
      expect(pushTapOf(tapOn(data, where))).toEqual(data);
    }
  });

  it('won’t follow a tap out of the app', () => {
    expect(pushTapOf(tapOn({ url: 'https://example.com' }))).toEqual({});
    expect(pushTapOf(tapOn({ url: '//example.com' }))).toEqual({});
  });

  it('opens the tap that launched the app, once', async () => {
    lastResponse.mockResolvedValue(tapOn({ url: '/applications/a' }));
    await mount();
    expect(mockNavigate).toHaveBeenCalledWith('/applications/a');
    expect(Notifications.clearLastNotificationResponseAsync).toHaveBeenCalled();
  });

  it('opens a tap while it’s running, and stops listening when it goes', async () => {
    await mount();
    const listen = Notifications.addNotificationResponseReceivedListener as jest.Mock;
    const [[listener]] = listen.mock.calls as [[(response: TappedNotification) => void]];
    await act(async () => listener(tapOn({ url: '/jobs' })));
    expect(mockNavigate).toHaveBeenCalledWith('/jobs');
    await cleanup();
    expect(listen.mock.results[0]?.value.remove).toHaveBeenCalled();
  });
});
