import { render, screen } from '@testing-library/react';

import { PageHeader } from '@/navigation/PageHeader';

describe('PageHeader', () => {
  it('renders the eyebrow, the title and the line under it', () => {
    render(
      <PageHeader
        eyebrow="Jobs"
        title="Find the right opportunities"
        subtitle="Discover jobs that match your skills and career goals."
      />,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Find the right opportunities' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Discover jobs that match your skills and career goals.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Jobs')).toBeInTheDocument();
    // The app-wide actions are the layout's TopBar, not part of each page's header.
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });
});
