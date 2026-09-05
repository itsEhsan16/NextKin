import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Disclosure } from '@/ui/Disclosure';

const BODY = 'Recruiters see the same score you do.';
const QUESTION = 'How is the ATS score calculated?';

/** The body enters with `FadeIn`; under the Reanimated jest mock its opacity stays 0 ("hidden"). */
const hidden = { includeHiddenElements: true } as const;

/** Mounts the inline variant and hands back the controlled prop as a setter, the way a screen owns it. */
async function renderInline(expanded: boolean) {
  const onToggle = jest.fn();
  const inline = (value: boolean) => (
    <Disclosure expanded={value} onToggle={onToggle}>
      <Text>{BODY}</Text>
    </Disclosure>
  );
  const view = await render(inline(expanded));
  return { onToggle, setExpanded: (value: boolean) => view.rerender(inline(value)) };
}

describe('Disclosure', () => {
  afterEach(async () => {
    await cleanup();
  });

  it('keeps the body unmounted and offers "Show more" while collapsed', async () => {
    await renderInline(false);

    // Unmounted, not merely transparent — the collapsed height is the whole point of the control.
    expect(screen.queryByText(BODY, hidden)).toBeNull();
    expect(screen.getByText('Show more')).toBeOnTheScreen();
    expect(screen.queryByText('Show less')).toBeNull();
  });

  it('mounts the body and flips the trigger to "Show less" when expanded', async () => {
    await renderInline(true);

    expect(screen.getByText(BODY, hidden)).toBeOnTheScreen();
    expect(screen.getByText('Show less')).toBeOnTheScreen();
    expect(screen.queryByText('Show more')).toBeNull();
  });

  it('publishes the expanded state on the trigger, both ways round', async () => {
    const { setExpanded } = await renderInline(false);
    expect(screen.getByRole('button', { name: 'Show more' })).toBeCollapsed();

    await setExpanded(true);
    expect(screen.getByRole('button', { name: 'Show less' })).toBeExpanded();
  });

  it('reports the press instead of toggling itself — the caller owns the state', async () => {
    const { onToggle } = await renderInline(false);

    fireEvent.press(screen.getByRole('button', { name: 'Show more' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
    // Controlled: the prop never changed, so the body stayed shut.
    expect(screen.getByRole('button', { name: 'Show more' })).toBeCollapsed();
    expect(screen.queryByText(BODY, hidden)).toBeNull();
  });

  it('names the row variant by its title and reveals the answer under it', async () => {
    const onToggle = jest.fn();
    await render(
      <Disclosure mode="row" title={QUESTION} expanded onToggle={onToggle}>
        <Text>{BODY}</Text>
      </Disclosure>,
    );

    // The row is its own trigger, so the question is the label — there is no "Show less" to read.
    expect(screen.getByRole('button', { name: QUESTION })).toBeExpanded();
    expect(screen.getByText(BODY, hidden)).toBeOnTheScreen();
    expect(screen.queryByText('Show less')).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: QUESTION }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
