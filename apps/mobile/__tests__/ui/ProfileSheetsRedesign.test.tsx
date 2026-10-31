import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ConfirmSheetBody } from '@/ui/ConfirmSheet';
import { OptionSheetBody } from '@/ui/OptionSheet';

/** PROFILE 17–24 (Figma 577:53 … 577:3232): the card option sheet and the centred confirm. */
describe('profile sheets redesign', () => {
  afterEach(async () => {
    await cleanup();
  });

  it('leads a card option sheet with its art and closes with a footnote', async () => {
    const onSelect = jest.fn();
    await render(
      <OptionSheetBody
        title="Availability"
        variant="card"
        art={<Text>availability art</Text>}
        footnote="Only used for matching — never shown on your resume."
        options={[
          { key: 'now', label: 'Available now' },
          { key: 'offers', label: 'Open to offers' },
        ]}
        selectedKey="offers"
        onSelect={onSelect}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText('availability art')).toBeTruthy();
    expect(screen.getByText('Only used for matching — never shown on your resume.')).toBeTruthy();
    expect(screen.getByLabelText('Open to offers').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    fireEvent.press(screen.getByLabelText('Available now'));
    expect(onSelect).toHaveBeenCalledWith('now');
  });

  it('shows a disabled option without letting it be picked', async () => {
    const onSelect = jest.fn();
    await render(
      <OptionSheetBody
        title="Appearance"
        variant="card"
        options={[
          { key: 'light', label: 'Light' },
          { key: 'dark', label: 'Dark', caption: 'Coming soon', disabled: true },
        ]}
        selectedKey="light"
        onSelect={onSelect}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText('Coming soon')).toBeTruthy();
    expect(screen.getByLabelText('Dark')).toBeDisabled();
    expect(screen.getByLabelText('Light')).toBeEnabled();
    fireEvent.press(screen.getByLabelText('Dark'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('centres the confirm under its art and routes both buttons', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    await render(
      <ConfirmSheetBody
        title="Delete role?"
        message="This role and the skills on it come off your profile."
        confirmLabel="Delete"
        art={<Text>role art</Text>}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText('role art')).toBeTruthy();
    fireEvent.press(screen.getByText('Delete'));
    fireEvent.press(screen.getByText('Cancel'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
