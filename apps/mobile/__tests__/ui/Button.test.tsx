import { cleanup, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { lightTheme } from '@/theme';
import { Button } from '@/ui/Button';

const opacityOf = (label: string) =>
  StyleSheet.flatten(screen.getByRole('button', { name: label }).props.style).opacity;

describe('Button', () => {
  afterEach(async () => {
    await cleanup();
  });

  it('keeps its label laid out while loading, so a hugging button holds its width', async () => {
    await render(<Button label="Save changes" loading />);

    // The label is still there (hidden from assistive tech), with the spinner over it.
    expect(screen.getByText('Save changes', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText('Save changes')).toBeNull();
    const button = screen.getByRole('button', { name: 'Save changes' });
    expect(button).toBeBusy();
    expect(button).toBeDisabled();
  });

  it('stays at full strength while loading: busy is not unavailable', async () => {
    await render(<Button label="Save changes" loading />);

    expect(opacityOf('Save changes')).toBe(1);
  });

  it('dims when it is genuinely disabled', async () => {
    await render(<Button label="Save changes" disabled />);

    expect(opacityOf('Save changes')).toBe(lightTheme.opacity.disabled);
  });
});
