import { render, screen } from '@testing-library/react';
import type { Route } from 'next';

import { ComingSoonScreen } from '@/features/comingSoon/ComingSoonScreen';
import { NotFoundScreen } from '@/features/system/SystemScreens';
import { ComingSoon } from '@/ui/ComingSoon';

describe('ComingSoonScreen', () => {
  it('says what the page will do, offers what works today and a way back', () => {
    render(<ComingSoonScreen page="interview" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Interview Prep' })).toBeInTheDocument();
    // The back button says where it goes (redesign R7d, SY-04).
    expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/');
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Interview Prep is coming soon' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/so you walk in knowing what they will ask/)).toBeInTheDocument();
    // One action: the nearest thing that works today.
    expect(screen.getByRole('link', { name: 'See your applications' })).toHaveAttribute(
      'href',
      '/applications',
    );
    // The page's one action is that, not another way home: only the header goes back.
    expect(screen.getAllByRole('link', { name: 'Back to Home' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Help & support' })).toHaveAttribute('href', '/help');
    // No more "Not built yet" dead end, and no planning note for the team.
    expect(screen.queryByText(/Not built yet/)).toBeNull();
    expect(screen.queryByText(/Planned:/)).toBeNull();
    expect(screen.queryByText(/V2 §/)).toBeNull();
  });

  it('offers the way back as the action when there is no alternative', () => {
    render(
      <ComingSoon
        title="Reports"
        section="V2 §0"
        description="Charts of how your search is going."
        back={{ label: 'Back to Applications', href: '/applications' as Route }}
      />,
    );

    // The header's back and the page's action both go there, and both say so.
    for (const link of screen.getAllByRole('link', { name: 'Back to Applications' })) {
      expect(link).toHaveAttribute('href', '/applications');
    }
    expect(
      screen.getByRole('heading', { level: 2, name: 'Reports is coming soon' }),
    ).toBeInTheDocument();
  });
});

describe('NotFoundScreen', () => {
  it('keeps the reader in the app with a way home', () => {
    render(<NotFoundScreen />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'We couldn’t find that page' }),
    ).toBeInTheDocument();
    for (const link of screen.getAllByRole('link', { name: 'Back to Home' })) {
      expect(link).toHaveAttribute('href', '/');
    }
  });
});
