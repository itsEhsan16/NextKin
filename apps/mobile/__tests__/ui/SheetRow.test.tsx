import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';

import { SheetRow, type SheetRowProps } from '@/ui/SheetRow';

/**
 * The locked state that the Phase 9C/9E paywall rows use (V2 §13.5: the gate is named on a
 * working control, never hidden behind a dead one). Two halves are pinned here: the gate reaches
 * a screen reader through the row's own name — the badges are decoration, so the row stays one
 * focus stop — and a locked row still fires, because the caller is what routes it to upgrade.
 */

const onPress = jest.fn();

const renderRow = (props: Partial<SheetRowProps> = {}) =>
  render(
    <SheetRow
      icon="file-word"
      label="Export as DOCX"
      description="Keep your formatting in Word"
      onPress={onPress}
      {...props}
    />,
  );

describe('SheetRow — locked', () => {
  beforeEach(() => {
    onPress.mockClear();
  });

  afterEach(async () => {
    await cleanup();
  });

  it('folds the gate into the row name', async () => {
    await renderRow({ locked: true });

    expect(screen.getByLabelText('Export as DOCX, Pro feature')).toBeOnTheScreen();
    // The lock is a font glyph with no name to query, so it is counted instead: it is the third
    // child of the row, after the icon tile and the text column.
    expect(screen.getByLabelText('Export as DOCX, Pro feature').children).toHaveLength(3);
  });

  it('draws the Pro badge outside the accessibility tree', async () => {
    await renderRow({ locked: true });

    // The default text query skips hidden subtrees, so this is null only while the wrapper is
    // there; the second line proves the badge is still drawn rather than dropped.
    expect(screen.queryByText('Pro')).toBeNull();
    expect(screen.getByText('Pro', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('still opens when locked', async () => {
    await renderRow({ locked: true });

    fireEvent.press(screen.getByLabelText('Export as DOCX, Pro feature'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('names both badges in order when the action is AI and paywalled', async () => {
    await renderRow({ ai: true, locked: true });

    expect(screen.getByLabelText('Export as DOCX, AI powered, Pro feature')).toBeOnTheScreen();
  });

  it('renders neither the badge nor the lock when the row is not locked', async () => {
    await renderRow();

    expect(screen.getByLabelText('Export as DOCX')).toBeOnTheScreen();
    expect(screen.queryByText('Pro', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByLabelText('Export as DOCX').children).toHaveLength(2);
  });
});
