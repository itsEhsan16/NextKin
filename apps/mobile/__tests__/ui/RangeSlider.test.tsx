import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { formatSalaryStep } from '@/lib';
import { RangeSlider } from '@/ui/RangeSlider';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const MAX = 80_000;
const onChange = jest.fn();

const format = (value: number) => formatSalaryStep(value, { plus: value >= MAX });

/** Controlled, like the sheet: the slider never owns the committed value. */
function Harness({ initial = [20_000, 45_000] as [number, number] }) {
  const [value, setValue] = useState<[number, number]>(initial);
  return (
    <RangeSlider
      min={0}
      max={MAX}
      step={1_000}
      minDistance={5_000}
      a11yStep={5_000}
      value={value}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
      thumbLabels={['Minimum salary', 'Maximum salary']}
      format={format}
    />
  );
}

/**
 * `accessibilityAction` is a custom event, so RNTL does not flush the resulting state update
 * synchronously — without the act pass the next adjust would read the previous value's props.
 */
const adjust = (label: string, actionName: 'increment' | 'decrement') =>
  act(async () => {
    fireEvent(screen.getByLabelText(label), 'accessibilityAction', { nativeEvent: { actionName } });
  });

describe('RangeSlider (JOBS 04 · 1:799–1:802)', () => {
  beforeEach(() => {
    onChange.mockClear();
  });

  afterEach(async () => {
    await cleanup();
  });

  async function renderSlider(initial?: [number, number]) {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <Harness {...(initial ? { initial } : {})} />
      </SafeAreaProvider>,
    );
  }

  it('exposes both thumbs as adjustable, announcing a formatted value', async () => {
    await renderSlider();

    const low = screen.getByLabelText('Minimum salary');
    expect(low).toHaveProp('accessibilityRole', 'adjustable');
    // `now` alone would be read out as "2000000"; the text is what makes it speakable.
    expect(low).toHaveProp('accessibilityValue', {
      min: 0,
      max: MAX,
      now: 20_000,
      text: '$20k',
    });
    expect(screen.getByLabelText('Maximum salary')).toHaveProp('accessibilityValue', {
      min: 0,
      max: MAX,
      now: 45_000,
      text: '$45k',
    });
  });

  it('is operable without dragging, in both directions', async () => {
    await renderSlider();

    await adjust('Minimum salary', 'increment');
    expect(onChange).toHaveBeenLastCalledWith([25_000, 45_000]);

    await adjust('Maximum salary', 'decrement');
    expect(onChange).toHaveBeenLastCalledWith([25_000, 40_000]);
  });

  it('clamps at the scale ends instead of running past them', async () => {
    await renderSlider([0, MAX]);

    await adjust('Minimum salary', 'decrement');
    expect(onChange).toHaveBeenLastCalledWith([0, MAX]);

    await adjust('Maximum salary', 'increment');
    expect(onChange).toHaveBeenLastCalledWith([0, MAX]);
  });

  it('stops the thumbs a gap apart rather than letting them swap', async () => {
    await renderSlider([40_000, 45_000]);

    // Already at the minimum gap, so incrementing the low thumb must not move it past the high one.
    await adjust('Minimum salary', 'increment');
    expect(onChange).toHaveBeenLastCalledWith([40_000, 45_000]);
  });

  it('reports the open-ended top stop as "$80k+"', async () => {
    await renderSlider([20_000, MAX]);

    expect(screen.getByLabelText('Maximum salary')).toHaveProp(
      'accessibilityValue',
      expect.objectContaining({ text: '$80k+' }),
    );
  });
});
