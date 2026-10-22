import { render } from '@testing-library/react';

import { SlidingHighlight } from '@/ui/SlidingHighlight';

const highlight = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-highlight]');

describe('SlidingHighlight', () => {
  it('sits on the selected row, stepping by the row and gap it is given', () => {
    const { container } = render(<SlidingHighlight index={3} row="var(--row)" gap="var(--gap)" />);

    expect(highlight(container)).toHaveAttribute('data-visible', 'true');
    expect(highlight(container)?.style.getPropertyValue('--slide-index')).toBe('3');
    expect(highlight(container)?.style.getPropertyValue('--slide-row')).toBe('var(--row)');
    expect(highlight(container)?.style.getPropertyValue('--slide-gap')).toBe('var(--gap)');
  });

  it('fades out where it last was when nothing is selected, and comes back from there', () => {
    const { container, rerender } = render(<SlidingHighlight index={3} row="1px" gap="1px" />);

    rerender(<SlidingHighlight index={-1} row="1px" gap="1px" />);
    expect(highlight(container)).toHaveAttribute('data-visible', 'false');
    expect(highlight(container)?.style.getPropertyValue('--slide-index')).toBe('3');

    rerender(<SlidingHighlight index={5} row="1px" gap="1px" />);
    expect(highlight(container)).toHaveAttribute('data-visible', 'true');
    expect(highlight(container)?.style.getPropertyValue('--slide-index')).toBe('5');
  });
});
