import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Dialog, DialogDescription, DialogTitle } from '@/ui/Dialog';

/** The shared modal shell (redesign R3a): one width step, corners, scrim and stacking for all. */
describe('Dialog', () => {
  it('stacks on the modal layer over its scrim, at the size asked for', () => {
    render(
      <Dialog open onOpenChange={() => {}} size="lg">
        <DialogTitle>Pick a resume</DialogTitle>
        <DialogDescription>Choose one to tailor.</DialogDescription>
      </Dialog>,
    );
    const panel = screen.getByRole('dialog', { name: 'Pick a resume' });
    expect(panel).toHaveClass(
      'z-modal',
      'rounded-2xl',
      'shadow-dialog',
      'w-[min(640px,calc(100vw-2rem))]',
    );
    expect(panel).toHaveAccessibleDescription('Choose one to tailor.');
    expect(document.querySelector('.z-overlay')).toHaveClass('bg-surface-overlay');
  });

  it('asks to close on Escape, so a busy dialog can refuse', async () => {
    const onOpenChange = jest.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogTitle>Delete resume?</DialogTitle>
        <DialogDescription>This can&apos;t be undone.</DialogDescription>
      </Dialog>,
    );
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('lets a dialog add its own layout to the panel', () => {
    render(
      <Dialog open onOpenChange={() => {}} className="gap-5 p-7">
        <DialogTitle>Method</DialogTitle>
        <DialogDescription>How to start.</DialogDescription>
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toHaveClass('gap-5', 'p-7');
  });
});
