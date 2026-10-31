import type { ResumeContent } from '@nextkin/shared/models';
import { render, screen } from '@testing-library/react';

import { ResumeSheet } from '@/features/resumes/components/ResumeSheet';

const body: ResumeContent = {
  kind: 'resume',
  resumeId: 'r',
  versionId: 'v',
  contact: { email: 'pro@nextkin.test' },
  summary: '',
  skills: [],
  experience: [],
  projects: [],
  certifications: [],
  education: [],
};

describe('ResumeSheet (toreview §137)', () => {
  it("prints the resume's own header over the account's name and email", () => {
    render(
      <ResumeSheet
        name="Priya Pro"
        body={{ ...body, header: { name: 'Mohammad Ehsan', items: [{ text: 'md@example.com' }] } }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Mohammad Ehsan' })).toBeInTheDocument();
    expect(screen.getByText('md@example.com')).toBeInTheDocument();
    expect(screen.queryByText('Priya Pro')).toBeNull();
    expect(screen.queryByText('pro@nextkin.test')).toBeNull();
  });

  it('falls back to the account when the resume has no header of its own', () => {
    render(<ResumeSheet name="Priya Pro" body={body} />);
    expect(screen.getByRole('heading', { name: 'Priya Pro' })).toBeInTheDocument();
  });
});
