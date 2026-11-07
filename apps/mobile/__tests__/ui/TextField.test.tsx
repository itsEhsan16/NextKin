import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { AccessibilityInfo } from 'react-native';

import { TextField } from '@/ui/TextField';

const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

/** Lets the error effect run. */
const flush = async () => {
  await act(async () => {});
};

describe('TextField', () => {
  afterEach(async () => {
    await cleanup();
    jest.clearAllMocks();
  });

  it('labels the input and reports typing', async () => {
    const onChangeText = jest.fn();
    await render(<TextField label="Email" value="" onChangeText={onChangeText} />);

    fireEvent.changeText(screen.getByLabelText('Email'), 'ada@example.com');
    expect(onChangeText).toHaveBeenCalledWith('ada@example.com');
  });

  it('announces an error once, not again on every keystroke under it', async () => {
    const { rerender } = await render(
      <TextField label="Email" value="ada" onChangeText={jest.fn()} error="Enter a valid email" />,
    );
    await flush();

    expect(screen.getByText('Enter a valid email').props.accessibilityLiveRegion).toBe('polite');
    expect(announce).toHaveBeenCalledTimes(1);
    // Said, never felt: only the bottom bar vibrates (§191).
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();

    // The user keeps typing towards the fix; the same error is still showing, so re-announcing
    // it would talk over them.
    await rerender(
      <TextField label="Email" value="ada@" onChangeText={jest.fn()} error="Enter a valid email" />,
    );
    await flush();
    expect(announce).toHaveBeenCalledTimes(1);

    // And the message itself sharpens while the field stays in error — the ref, not the effect's
    // dependency array, is what keeps this one quiet.
    await rerender(
      <TextField label="Email" value="ada@" onChangeText={jest.fn()} error="Enter a work email" />,
    );
    await flush();
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('counts the value against the limit', async () => {
    await render(
      <TextField label="Headline" value="abc" onChangeText={jest.fn()} maxLength={10} showCount />,
    );

    expect(screen.getByText('3/10', { includeHiddenElements: true })).toBeOnTheScreen();
    // The hint already says the limit, so the counter is not a second screen-reader stop.
    expect(screen.queryByText('3/10')).toBeNull();
  });

  it('keeps focus alive for a next-field return key', async () => {
    const onSubmit = jest.fn();
    await render(
      <TextField
        label="First name"
        value=""
        onChangeText={jest.fn()}
        returnKeyType="next"
        onSubmit={onSubmit}
      />,
    );

    const input = screen.getByLabelText('First name');
    expect(input.props.submitBehavior).toBe('submit');

    fireEvent(input, 'submitEditing');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('leaves the return key as a newline when multiline', async () => {
    await render(<TextField label="Summary" value="" onChangeText={jest.fn()} multiline />);

    expect(screen.getByLabelText('Summary').props.submitBehavior).toBe('newline');
  });

  it('marks a read-only field disabled', async () => {
    await render(
      <TextField label="Email" value="ada@example.com" onChangeText={jest.fn()} editable={false} />,
    );

    const input = screen.getByLabelText('Email');
    // Asserted on the prop, not through toBeDisabled(): RNTL reports any non-editable TextInput
    // as disabled before it ever reads accessibilityState, so the matcher alone would pass
    // against a field that exposes no state at all.
    expect(input.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    expect(input).toBeDisabled();
  });
});
