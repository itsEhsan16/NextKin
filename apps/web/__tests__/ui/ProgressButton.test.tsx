import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ProgressButton, type ProgressPhase } from '@/ui/ProgressButton';

const STAGES = ['Reading the job…', 'Analyzing…', 'Almost there…'];

function renderButton(
  phase: ProgressPhase,
  props: Partial<Parameters<typeof ProgressButton>[0]> = {},
) {
  return render(
    <ProgressButton phase={phase} stages={STAGES} {...props}>
      Continue
    </ProgressButton>,
  );
}

const fill = () => screen.getByTestId('progress-fill');
const filled = () => Number(/(-?[\d.]+)%/.exec(fill().style.translate)?.[1] ?? NaN) + 100;

describe('ProgressButton (toreview §219)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('rests empty and presses through while idle', async () => {
    const onClick = jest.fn();
    renderButton('idle', { onClick });
    const button = screen.getByRole('button', { name: 'Continue' });
    expect(button).not.toHaveAttribute('aria-busy');
    expect(filled()).toBe(0);
    await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('works without greying out: busy, refuses presses, walks the stages, never claims to finish', async () => {
    const onClick = jest.fn();
    renderButton('working', { onClick });
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Reading the job…');

    await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).click(button);
    expect(onClick).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(2000));
    expect(screen.getByRole('status')).toHaveTextContent('Analyzing…');
    act(() => jest.advanceTimersByTime(30_000));
    expect(screen.getByRole('status')).toHaveTextContent('Almost there…');
    expect(filled()).toBeGreaterThan(80);
    expect(filled()).toBeLessThanOrEqual(90);
  });

  it('runs to the end when the work resolves, then calls onFilled', () => {
    const onFilled = jest.fn();
    const { rerender } = renderButton('working', { onFilled });
    act(() => jest.advanceTimersByTime(1000));
    rerender(
      <ProgressButton phase="done" stages={STAGES} onFilled={onFilled}>
        Continue
      </ProgressButton>,
    );
    expect(filled()).toBe(100);
    expect(onFilled).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(800));
    expect(onFilled).toHaveBeenCalledTimes(1);
  });

  it('drains on a failure and is ready to press again', () => {
    const { rerender } = renderButton('working');
    act(() => jest.advanceTimersByTime(1000));
    expect(filled()).toBeGreaterThan(0);
    rerender(
      <ProgressButton phase="failed" stages={STAGES}>
        Continue
      </ProgressButton>,
    );
    expect(filled()).toBe(0);
    expect(screen.getByRole('button', { name: 'Continue' })).not.toHaveAttribute('aria-busy');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('says the caller’s own stage when given one', () => {
    renderButton('working', { stage: 'Starting the check…' });
    expect(screen.getByRole('status')).toHaveTextContent('Starting the check…');
  });
});
