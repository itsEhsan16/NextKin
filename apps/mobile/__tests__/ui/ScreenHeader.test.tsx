import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { Dimensions, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { themeFor } from '@/theme';
import { IconButton } from '@/ui/IconButton';
import { ScreenHeader } from '@/ui/ScreenHeader';

/** The header reads nothing but the theme, and jest's 750dp window clamps the scale to 1. */
const theme = themeFor('light', Dimensions.get('window').width);

/** `react-test-renderer` types are not installed, so the instance type comes off a query. */
type Instance = ReturnType<typeof screen.getByLabelText>;

const flat = (value: unknown): Record<string, unknown> =>
  (StyleSheet.flatten(value as StyleProp<ViewStyle>) ?? {}) as Record<string, unknown>;

/** First slot in the header row: the back button, or the spacer standing in for it. */
const leadingSlot = (title: string): Instance => {
  const first = screen.getByRole('header', { name: title }).parent?.children[0];
  if (!first || typeof first === 'string') throw new Error('expected a leading slot in the row');
  return first;
};

describe('ScreenHeader', () => {
  afterEach(async () => {
    await cleanup();
  });

  it('announces the screen name as a header', async () => {
    await render(<ScreenHeader title="ATS score" onBack={jest.fn()} />);

    expect(screen.getByRole('header', { name: 'ATS score' })).toBeOnTheScreen();
  });

  it('goes back from the chevron', async () => {
    const onBack = jest.fn();
    await render(<ScreenHeader title="ATS score" onBack={onBack} />);

    fireEvent.press(screen.getByLabelText('Back'));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('keeps the title centred with a back-button-wide spacer when there is no back', async () => {
    // Without the spacer the title centres on the row *left* of the trailing slot, which reads
    // as a rendering bug rather than a design: a title visibly off the screen's centre.
    await render(<ScreenHeader title="ATS score" />);

    expect(screen.queryByLabelText('Back')).toBeNull();
    expect(flat(leadingSlot('ATS score').props.style).width).toBe(theme.sizes.iconButton);
  });

  it('renders trailing content and lets it be pressed', async () => {
    const onPress = jest.fn();
    await render(
      <ScreenHeader
        title="ATS score"
        onBack={jest.fn()}
        trailing={<IconButton icon="DotsHorizontal" label="More" onPress={onPress} />}
      />,
    );

    fireEvent.press(screen.getByLabelText('More'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('sets the page variant title in the pageTitle role', async () => {
    await render(
      <ScreenHeader variant="page" title="Notification preferences" onBack={jest.fn()} />,
    );

    const title = screen.getByRole('header', { name: 'Notification preferences' });
    expect(flat(title.props.style).fontSize).toBe(theme.typography.pageTitle.fontSize);
  });
});
