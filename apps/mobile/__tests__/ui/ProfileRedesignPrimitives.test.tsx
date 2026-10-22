import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { NoteBar } from '@/ui/NoteBar';
import { OptionSheetBody } from '@/ui/OptionSheet';
import { SelectField } from '@/ui/SelectField';
import { TextField } from '@/ui/TextField';

/**
 * The shared pieces the redesigned profile editors (PROFILE 03–16) added to `@/ui`: the picker
 * field, the lavender note, the tiled option sheet, and TextField's
 * "Optional" tag and unit.
 */
describe('profile redesign primitives', () => {
  afterEach(async () => {
    await cleanup();
  });

  it('reads a picker field as its label and value', async () => {
    const onPress = jest.fn();
    await render(
      <SelectField
        label="Start"
        value="Jun 2019"
        hint="Opens the month picker"
        onPress={onPress}
      />,
    );
    fireEvent.press(screen.getByLabelText('Start, Jun 2019'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('goes inert when the value is fixed', async () => {
    const onPress = jest.fn();
    await render(
      <SelectField
        label="End"
        value="Present"
        hint="Opens the month picker"
        disabled
        onPress={onPress}
      />,
    );
    expect(screen.getByLabelText('End, Present')).toBeDisabled();
  });

  it('shows the placeholder when nothing is picked', async () => {
    await render(
      <SelectField
        label="Issued"
        placeholder="Not set"
        hint="Opens the month picker"
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByLabelText('Issued, Not set')).toBeOnTheScreen();
    expect(screen.getByText('Not set')).toBeOnTheScreen();
  });

  it('sets the note copy beside its icon', async () => {
    await render(<NoteBar text="Only used for matching — never shown on your resume." />);
    expect(
      screen.getByText('Only used for matching — never shown on your resume.'),
    ).toBeOnTheScreen();
  });

  it('gives a tiled option sheet its leading tiles and marks the picked row', async () => {
    const onSelect = jest.fn();
    await render(
      <OptionSheetBody
        title="What kind of link?"
        options={[
          { key: 'portfolio', label: 'Portfolio', leading: <Text>tile-portfolio</Text> },
          { key: 'github', label: 'GitHub', leading: <Text>tile-github</Text> },
        ]}
        selectedKey="portfolio"
        onSelect={onSelect}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText('tile-portfolio')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Portfolio' })).toBeSelected();
    fireEvent.press(screen.getByRole('radio', { name: 'GitHub' }));
    expect(onSelect).toHaveBeenCalledWith('github');
  });

  it('marks an optional field and sets its unit at the end of the box', async () => {
    await render(
      <TextField
        label="Years of experience"
        optional
        suffix="years"
        value="8"
        onChangeText={jest.fn()}
      />,
    );
    expect(screen.getByText('Optional')).toBeOnTheScreen();
    expect(screen.getByText('years')).toBeOnTheScreen();
    expect(screen.getByLabelText('Years of experience').props.value).toBe('8');
  });
});
