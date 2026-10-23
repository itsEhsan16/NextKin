import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren, ReactElement } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { BuildAddJobScreen, BuildUnreadableScreen } from '@/features/create';
import { buildAddInput } from '@/features/create/screens/BuildAddJobScreen';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockDismissTo = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    navigate: jest.fn(),
    back: jest.fn(),
    replace: mockReplace,
    dismissTo: mockDismissTo,
    setParams: jest.fn(),
  }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function renderWithClient(ui: ReactElement) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </SafeAreaProvider>,
  );
}

const settle = (ms = 3000) => act(() => jest.advanceTimersByTimeAsync(ms));

describe('Build: add a job from anywhere (BUILD 03 / 05b)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    [mockPush, mockReplace, mockDismissTo].forEach((mock) => mock.mockClear());
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    jest.useRealTimers();
  });

  it('reads a lone URL-looking token as a link and anything else as pasted text', () => {
    expect(buildAddInput('  cred.club/careers/senior  ', null)).toEqual({
      source: 'link',
      url: 'cred.club/careers/senior',
    });
    expect(buildAddInput('Senior designer at CRED', null)).toEqual({
      source: 'paste',
      text: 'Senior designer at CRED',
    });
    expect(buildAddInput('   ', null)).toBeNull();
  });

  it('keeps the button off until there is input, then reads a paste and opens the review', async () => {
    await renderWithClient(<BuildAddJobScreen />);
    expect(screen.getByText('Add the job')).toBeOnTheScreen();
    expect(screen.getByText('Supported links')).toBeOnTheScreen();
    expect(screen.getByLabelText('Upload a job file instead')).toBeOnTheScreen();
    expect(screen.getByText('Paste a job or upload a file to continue')).toBeOnTheScreen();
    expect(screen.getByLabelText('Build my resume')).toBeDisabled();

    await act(async () => fireEvent.press(screen.getByText('Description')));
    expect(screen.queryByText('Supported links')).not.toBeOnTheScreen();
    await act(async () =>
      fireEvent.changeText(
        screen.getByLabelText('Job description'),
        'Senior Product Designer at CRED. Must have Figma and design systems.',
      ),
    );
    await act(async () => fireEvent.press(screen.getByLabelText('Build my resume')));
    expect(screen.getByLabelText('Reading the job…')).toBeOnTheScreen();
    await settle();

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/create/build/review',
      params: { jdId: expect.any(String) },
    });
  });

  it('offers the file on its own tab, with what can be read', async () => {
    await renderWithClient(<BuildAddJobScreen />);
    await act(async () => fireEvent.press(screen.getByText('Upload file')));
    expect(screen.getByLabelText('Upload a job file instead')).toBeOnTheScreen();
    expect(screen.getByText('What we can read')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Job link')).not.toBeOnTheScreen();
  });

  it('opens on the Description tab when 05b sends the user back to paste', async () => {
    await renderWithClient(<BuildAddJobScreen mode="paste" at="1" />);
    expect(screen.getByLabelText('Job description')).toBeOnTheScreen();
  });

  it('sends a LinkedIn link that will not read to the unreadable screen', async () => {
    const url = 'https://careers.blocked-site.example/jobs/123';
    await renderWithClient(<BuildAddJobScreen />);
    await act(async () => fireEvent.changeText(screen.getByLabelText('Job link'), url));
    await act(async () => fireEvent.press(screen.getByLabelText('Build my resume')));
    await settle();

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/create/build/unreadable',
      params: { url },
    });
  });

  it('offers paste-instead and a retry that stays put while the page still blocks reading', async () => {
    await renderWithClient(<BuildUnreadableScreen url="careers.blocked-site.example/jobs/1" />);
    expect(screen.getByText('We couldn’t read that job page')).toBeOnTheScreen();
    expect(screen.getByText('Why this happens')).toBeOnTheScreen();
    expect(screen.queryByText(/not counted/)).toBeNull();

    await act(async () => fireEvent.press(screen.getByLabelText('Try the link again')));
    await settle();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(
      screen.getByText('That page still blocks reading. Paste the description instead.'),
    ).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByLabelText('Paste the description')));
    expect(mockDismissTo).toHaveBeenCalledWith({
      pathname: '/create/build/add',
      params: { mode: 'paste', at: expect.any(String) },
    });
  });

  it('replaces itself with the review when the retry reads the page', async () => {
    await renderWithClient(<BuildUnreadableScreen url="cred.club/careers/senior" />);
    await act(async () => fireEvent.press(screen.getByLabelText('Try the link again')));
    await settle();
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/create/build/review',
      params: { jdId: expect.any(String) },
    });
  });
});
