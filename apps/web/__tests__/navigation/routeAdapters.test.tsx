import { render, screen } from '@testing-library/react';

import { JobsRoute } from '@/features/jobs/screens/JobsRoute';
import { ProfileRoute } from '@/features/profile/screens/ProfileRoute';
import { SettingsRoute } from '@/features/settings/screens/SettingsRoute';
import { PageTransition } from '@/ui/PageTransition';

let mockQuery = '';
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockQuery),
}));

/**
 * Each screen stands in as a probe that shows the props its route handed it. A function
 * declaration, so it exists when the hoisted `jest.mock` factories below call it.
 */
function mockProbe(name: string) {
  return function Probe(props: object) {
    return <output aria-label={name}>{JSON.stringify(props)}</output>;
  };
}
jest.mock('@/features/jobs/screens/JobsScreen', () => ({ JobsScreen: mockProbe('jobs') }));
jest.mock('@/features/profile/screens/ProfileScreen', () => ({
  ProfileScreen: mockProbe('profile'),
}));
jest.mock('@/features/settings/screens/SettingsScreen', () => ({
  SettingsScreen: mockProbe('settings'),
}));

const propsOf = (name: string) => JSON.parse(screen.getByLabelText(name).textContent ?? '{}');

describe('route adapters', () => {
  it('opens the job a link names', () => {
    mockQuery = 'job=job_google';
    render(<JobsRoute />);
    expect(propsOf('jobs')).toEqual({ initialJobId: 'job_google' });
  });

  it('opens on the default when the link names nothing', () => {
    mockQuery = '';
    render(<JobsRoute />);
    expect(propsOf('jobs')).toEqual({});
  });

  it('passes a known tab through and drops an unknown one', () => {
    mockQuery = 'tab=skills';
    render(<ProfileRoute />);
    expect(propsOf('profile')).toEqual({ initialTab: 'skills' });

    mockQuery = 'tab=nonsense';
    render(<SettingsRoute />);
    expect(propsOf('settings')).toEqual({});
  });
});

describe('PageTransition', () => {
  it('renders the page as it is where view transitions are unavailable', () => {
    render(
      <PageTransition>
        <h1>Jobs</h1>
      </PageTransition>,
    );
    expect(screen.getByRole('heading', { name: 'Jobs' })).toBeInTheDocument();
  });
});
