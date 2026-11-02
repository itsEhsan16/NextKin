import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { LineSource } from '@/data/models';
import { LineSourceBody } from '@/features/resumes/components/LineSourceSheet';
import { LineSourceContext, SourceLine } from '@/features/resumes/components/SourceLine';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const LINE = 'Rebuilt checkout for mobile';

const renderBody = (source: LineSource | undefined, state = { loading: false, failed: false }) =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <LineSourceBody line={LINE} source={source} {...state} />
    </SafeAreaProvider>,
  );

describe('where a line came from (toreview §146.4)', () => {
  afterEach(async () => {
    await cleanup();
  });

  it('says the AI wrote it, what it rests on, and the line it replaced', async () => {
    await renderBody({
      text: LINE,
      origin: 'generated',
      facts: ['Your Designer role at Acme'],
      before: 'Shipped the checkout',
    });

    expect(screen.getByRole('header', { name: 'Where this came from' })).toBeOnTheScreen();
    expect(screen.getByText(`“${LINE}”`)).toBeOnTheScreen();
    expect(screen.getByText('Written by the AI')).toBeOnTheScreen();
    expect(screen.getByText('Your Designer role at Acme')).toBeOnTheScreen();
    expect(screen.getByText('“Shipped the checkout”')).toBeOnTheScreen();
  });

  it('says a line is the person’s own, with nothing to list', async () => {
    await renderBody({ text: LINE, origin: 'user', facts: [] });

    expect(screen.getByText('Your words')).toBeOnTheScreen();
    expect(screen.queryByText('It rests on')).toBeNull();
    expect(screen.queryByText('Your line before')).toBeNull();
  });

  it('says an assumption is one, and to check it', async () => {
    await renderBody({ text: LINE, origin: 'assumed', facts: [] });

    expect(screen.getByText('Assumed')).toBeOnTheScreen();
    expect(screen.getByText('We guessed this. Check it before you download.')).toBeOnTheScreen();
  });

  it('holds its place while it loads, and says so when it can’t', async () => {
    await renderBody(undefined, { loading: true, failed: false });
    expect(screen.getByLabelText('Loading')).toBeOnTheScreen();
    await cleanup();

    await renderBody(undefined, { loading: false, failed: true });
    expect(screen.getByText(/^We couldn’t load this/)).toBeOnTheScreen();
    await cleanup();

    await renderBody(undefined, { loading: false, failed: false });
    expect(screen.getByText(/^This line has no source yet/)).toBeOnTheScreen();
  });

  it('washes a line the AI wrote or guessed, and leaves the person’s own plain', async () => {
    const origins: Record<string, 'generated' | 'assumed' | 'user'> = {
      a: 'generated',
      b: 'assumed',
      c: 'user',
    };
    await render(
      <LineSourceContext.Provider value={{ open: jest.fn(), originOf: (text) => origins[text] }}>
        {['a', 'b', 'c', 'd'].map((text) => (
          <SourceLine key={text} text={text}>
            <Text>{text}</Text>
          </SourceLine>
        ))}
      </LineSourceContext.Provider>,
    );
    expect(screen.getAllByTestId('ai-line')).toHaveLength(2);
    expect(screen.getByLabelText('a')).toHaveProp(
      'accessibilityHint',
      'Written by the AI. Shows where it came from',
    );
    expect(screen.getByLabelText('c')).toHaveProp(
      'accessibilityHint',
      'Shows where this came from',
    );
  });

  it('makes a line tappable only where the page can answer', async () => {
    const open = jest.fn();
    await render(
      <LineSourceContext.Provider value={{ open, originOf: () => 'user' }}>
        <SourceLine text={LINE}>
          <Text>{LINE}</Text>
        </SourceLine>
      </LineSourceContext.Provider>,
    );
    await fireEvent.press(screen.getByLabelText(LINE));
    expect(open).toHaveBeenCalledWith(LINE);
    await cleanup();

    await render(
      <SourceLine text={LINE}>
        <Text>{LINE}</Text>
      </SourceLine>,
    );
    expect(screen.getByText(LINE)).toBeOnTheScreen();
    expect(screen.queryByLabelText(LINE)).toBeNull();
  });
});
