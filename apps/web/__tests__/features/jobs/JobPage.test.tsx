import { render, screen } from '@testing-library/react';

import type { Job } from '@nextkin/shared/models';

import { MatchCard } from '@/features/jobs/components/page/JobSummary';

/** Redesign R5b: the job page's match card says only what the engine can back. */
const job = (patch: Partial<Job>): Job =>
  ({
    id: 'job_x',
    title: 'Product Designer',
    company: 'Acme',
    location: 'Remote',
    remote: 'remote',
    employmentType: 'full_time',
    experienceLevel: 'mid',
    postedAt: '2026-11-01T00:00:00.000Z',
    source: 'fixture',
    description: '',
    responsibilities: [],
    requirements: [],
    tags: [],
    isSaved: false,
    isPick: false,
    isTodaysPick: false,
    relevanceRank: 1,
    companyIndustry: '',
    companySize: '',
    companyWebsite: '',
    ...patch,
  }) as Job;

const basis = (kind: 'full' | 'snippet') => ({
  kind,
  requiredMet: 3,
  requiredPartial: 0,
  requiredTotal: 4,
  preferredMet: 0,
  preferredTotal: 0,
  method: 'jobmatch-1',
});

describe('MatchCard', () => {
  it('shows the number only when the whole listing was read', () => {
    const { rerender } = render(
      <MatchCard
        job={job({ matchScore: 0.72, matchBand: 'good', matchBasis: basis('full') })}
        profile={undefined}
      />,
    );
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText('Good match')).toBeInTheDocument();

    rerender(
      <MatchCard
        job={job({ matchScore: 0.72, matchBand: 'good', matchBasis: basis('snippet') })}
        profile={undefined}
      />,
    );
    expect(screen.queryByText('72')).toBeNull();
    expect(screen.getByText('Good match')).toBeInTheDocument();
  });

  it('marks each row met or not met, not by word alone', () => {
    render(
      <MatchCard
        job={job({ matchScore: 0.72, matchBand: 'good', matchBasis: basis('full') })}
        profile={undefined}
      />,
    );
    // Requirements 3 of 4: not met.
    expect(screen.getByText('Requirements').nextElementSibling).toHaveTextContent(
      '3 of 4, not met',
    );
  });

  it('links the rubric by name', () => {
    render(
      <MatchCard
        job={job({ matchScore: 0.9, matchBand: 'strong', matchBasis: basis('full') })}
        profile={undefined}
      />,
    );
    expect(screen.getByRole('link', { name: 'How NextKin Score works' })).toHaveAttribute(
      'href',
      '/help',
    );
  });

  it('draws nothing for a job that has not been matched', () => {
    const { container } = render(<MatchCard job={job({})} profile={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
