import { render, screen } from '@testing-library/react';

import { AiLoader } from '@/ui/AiLoader';

describe('AiLoader (toreview §132.8)', () => {
  it('shows and announces its words as shimmer text', () => {
    render(<AiLoader text="Reading the job description…" />);
    expect(screen.getByRole('status')).toHaveTextContent('Reading the job description…');
  });

  it.each(['dots', 'loading-line', 'pulse-ring'] as const)(
    'announces what it is doing as %s, without showing the words',
    (variant) => {
      render(<AiLoader variant={variant} text="Thinking…" />);
      expect(screen.getByRole('status')).toHaveTextContent('Thinking…');
    },
  );

  it('stays out of the way beside its own status text when silent', () => {
    render(<AiLoader variant="loading-line" text="Reading" silent />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
