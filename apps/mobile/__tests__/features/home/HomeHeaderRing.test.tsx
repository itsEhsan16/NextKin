import { act, cleanup, render, screen } from '@testing-library/react-native';

import { HomeHeader } from '@/features/home/components/HomeHeader';

const noop = () => {};

describe('Home avatar ring (§244)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    jest.useRealTimers();
  });

  it('rings the avatar with profile completeness, says it in the hint, and shows no number', async () => {
    await render(
      <HomeHeader
        firstName="George"
        completeness={0.72}
        hasUnread={false}
        onPressNotifications={noop}
        onPressMenu={noop}
        onPressProfile={noop}
      />,
    );
    await act(async () => {});
    const button = screen.getByLabelText(/Your profile$/);
    expect(button.props.accessibilityHint).toBe('Opens your profile, 72% complete');
    expect(screen.queryByText(/%/)).not.toBeOnTheScreen();
    expect(screen.queryByRole('progressbar')).not.toBeOnTheScreen();
  });

  it('keeps the bare avatar when completeness is unknown', async () => {
    await render(
      <HomeHeader
        firstName="George"
        hasUnread={false}
        onPressNotifications={noop}
        onPressMenu={noop}
      />,
    );
    expect(screen.getByLabelText(/Your profile$/).props.accessibilityHint).toBe(
      'Opens your profile',
    );
  });
});
