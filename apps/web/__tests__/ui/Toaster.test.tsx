import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Route } from 'next';

import { dismissToast, showToast } from '@/lib/toast';
import { motion } from '@/theme/tokens';
import { Toaster } from '@/ui/Toaster';

/** The bar's exit is an animation; jsdom never runs it, so a test ends it by hand. */
const finishExit = () => {
  const bar = document.querySelector('[data-state="closed"]');
  if (bar) fireEvent.animationEnd(bar);
};

describe('Toaster', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => dismissToast());
    finishExit();
    jest.useRealTimers();
  });

  it('says a success politely, then leaves on its own', () => {
    render(<Toaster />);
    act(() => showToast('Preferences saved'));

    expect(screen.getByRole('status')).toHaveTextContent('Preferences saved');

    act(() => jest.advanceTimersByTime(motion.delays.toast));
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'closed');
    act(() => finishExit());
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('announces a failure assertively', () => {
    render(<Toaster />);
    act(() => showToast("Couldn't save. Changed back.", { tone: 'error' }));

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't save. Changed back.");
  });

  it('carries a next step, and stays up longer for it', () => {
    render(<Toaster />);
    act(() =>
      showToast('Application sent', {
        action: { label: 'View application', href: '/applications' as Route },
      }),
    );

    expect(screen.getByRole('link', { name: 'View application' })).toHaveAttribute(
      'href',
      '/applications',
    );
    act(() => jest.advanceTimersByTime(motion.delays.toast));
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'open');
    act(() => jest.advanceTimersByTime(motion.delays.toastWithAction - motion.delays.toast));
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'closed');
  });

  it('replaces the showing toast with a new one, which gets its full time', () => {
    render(<Toaster />);
    act(() => showToast('Saved'));
    act(() => jest.advanceTimersByTime(motion.delays.toast - 500));
    act(() => showToast('Link copied'));

    expect(screen.getByRole('status')).toHaveTextContent('Link copied');
    act(() => jest.advanceTimersByTime(motion.delays.toast - 500));
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'open');
  });

  it('can be dismissed with its ✕', () => {
    render(<Toaster />);
    act(() => showToast('Saved'));

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'closed');
  });
});
