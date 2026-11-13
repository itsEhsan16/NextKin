import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
      'w-dialog-lg',
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

describe('Dialog focus', () => {
  it('puts focus back on what opened it when it closes', async () => {
    const user = userEvent.setup();
    function Host() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Rename
          </button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTitle>Rename resume</DialogTitle>
            <DialogDescription>Pick a new name.</DialogDescription>
            <button type="button">Save</button>
          </Dialog>
        </>
      );
    }
    render(<Host />);
    const opener = screen.getByRole('button', { name: 'Rename' });
    await user.click(opener);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(opener).toHaveFocus());
  });
});
