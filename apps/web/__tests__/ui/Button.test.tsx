import { render, screen } from '@testing-library/react';

import { Button, buttonClass } from '@/ui/Button';
import { BUTTON_VARIANT } from '@/ui/buttonStyles';

/** One button map behind every helper (redesign R3b). */
describe('Button', () => {
  it('draws the primary flat, with no retired bevel', () => {
    // The legacy helper names are gone (redesign R8); every caller reads the map or `Button`.
    expect(buttonClass()).toContain(BUTTON_VARIANT.primary);
    expect(BUTTON_VARIANT.primary).not.toMatch(/button-rim|button-face/);
  });

  it('keeps paid fuchsia and danger red apart from the brand primary', () => {
    expect(buttonClass({ variant: 'paid' })).toContain('bg-action-paid');
    expect(buttonClass({ variant: 'danger' })).toContain('bg-action-danger');
    expect(buttonClass({ variant: 'danger-secondary' })).toContain('border-border-danger');
    expect(buttonClass({ variant: 'inverse' })).toContain('bg-action-inverse');
  });

  it('draws an icon-only button square, named by its label', () => {
    render(<Button iconOnly size="md" aria-label="Close" icon={<svg aria-hidden />} />);
    const button = screen.getByRole('button', { name: 'Close' });
    expect(button).toHaveClass('size-control-md');
    expect(button).not.toHaveClass('px-4');
  });

  it('guards itself while loading', () => {
    render(
      <Button loading busyLabel="Saving…">
        Save
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});
