import { useStall } from '@nextkin/shared/queries';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useState } from 'react';

import { PickedFile } from '@/features/upload/components/PickedFile';
import { dismissToast, showToast } from '@/lib/toast';
import { Button } from '@/ui/Button';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Toaster } from '@/ui/Toaster';

describe('Button', () => {
  it('guards itself while loading: disabled, busy, the busy label shown', () => {
    const onClick = jest.fn();
    render(
      <Button loading busyLabel="Saving…" onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.querySelector('[data-spinner]')).not.toBeNull();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('runs its action when idle', () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Save</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

function Views() {
  const [view, setView] = useState<'a' | 'b' | 'c'>('a');
  return (
    <SegmentedControl
      label="View"
      value={view}
      onChange={setView}
      segments={[
        { id: 'a', label: 'One' },
        { id: 'b', label: 'Two' },
        { id: 'c', label: 'Three' },
      ]}
    />
  );
}

describe('SegmentedControl', () => {
  it('chooses on click and with the arrow keys, Home and End', () => {
    render(<Views />);
    const tab = (name: string) => screen.getByRole('tab', { name });
    expect(tab('One')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Two')).toHaveAttribute('tabindex', '-1');

    fireEvent.click(tab('Two'));
    expect(tab('Two')).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(tab('Two'), { key: 'ArrowRight' });
    expect(tab('Three')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Three')).toHaveFocus();

    fireEvent.keyDown(tab('Three'), { key: 'ArrowRight' });
    expect(tab('One')).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(tab('One'), { key: 'End' });
    expect(tab('Three')).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(tab('Three'), { key: 'Home' });
    expect(tab('One')).toHaveAttribute('aria-selected', 'true');
  });
});

describe('PickedFile', () => {
  const file = { name: 'job.pdf', size: 2048 };

  it('offers no remove while the file is read', () => {
    render(<PickedFile file={file} reading onRemove={jest.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Reading…');
    expect(screen.queryByRole('button', { name: 'Remove job.pdf' })).toBeNull();
  });

  it('says it is ready and can be taken back', () => {
    const onRemove = jest.fn();
    render(<PickedFile file={file} onRemove={onRemove} />);
    expect(screen.getByRole('status')).toHaveTextContent('Ready');
    fireEvent.click(screen.getByRole('button', { name: 'Remove job.pdf' }));
    expect(onRemove).toHaveBeenCalled();
  });
});

describe('useStall', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('turns slow, then stalled, and starts over when the wait moves', () => {
    const { result, rerender } = renderHook(
      ({ active, progress }) => useStall(active, progress, { slowMs: 1000, failMs: 3000 }),
      { initialProps: { active: true, progress: 0 } },
    );
    expect(result.current).toBe('ok');
    act(() => jest.advanceTimersByTime(1000));
    expect(result.current).toBe('slow');
    act(() => jest.advanceTimersByTime(2000));
    expect(result.current).toBe('stalled');

    rerender({ active: true, progress: 1 });
    expect(result.current).toBe('ok');
    act(() => jest.advanceTimersByTime(1000));
    expect(result.current).toBe('slow');

    rerender({ active: false, progress: 1 });
    expect(result.current).toBe('ok');
  });
});

describe('Toaster actions', () => {
  afterEach(() => act(() => dismissToast()));

  it('runs an action that is a callback, and closes', () => {
    const retry = jest.fn();
    render(<Toaster />);
    act(() =>
      showToast('Couldn’t prepare the download.', {
        tone: 'error',
        action: { label: 'Try again', onClick: retry },
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toHaveAttribute('data-state', 'closed');
  });
});
