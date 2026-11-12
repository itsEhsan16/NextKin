import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Profile } from '@nextkin/shared/models';

import { withoutTitleLine } from '@/features/jobs/components/page/JobSummary';
import { skillEvidence, SkillEvidenceList } from '@/features/jobs/components/SkillEvidenceList';

/** Redesign R5c: one honest skills list for the job page and the JD page (D-14). */
const profile = {
  skills: ['Figma', 'Prototyping'],
  experiences: [{ skills: ['Figma'], startDate: '2021-01' }],
} as unknown as Profile;

describe('skill evidence', () => {
  it('tells a skill shown in a dated role from one only listed, and from one missing', () => {
    expect(skillEvidence(profile, 'figma')).toBe('shown');
    expect(skillEvidence(profile, 'Prototyping')).toBe('listed');
    expect(skillEvidence(profile, 'Design Systems')).toBe('missing');
    expect(skillEvidence(undefined, 'Figma')).toBe('missing');
  });

  it('says each state to screen readers and lets a missing skill be added', async () => {
    const onAdd = jest.fn();
    render(
      <SkillEvidenceList
        skills={['Figma', 'Prototyping', 'Design Systems']}
        profile={profile}
        label="Skills this job asks for"
        onAdd={onAdd}
      />,
    );
    expect(screen.getByText('(shown in a dated role)', { exact: false })).toBeInTheDocument();
    expect(
      screen.getByText('(listed on your profile, not shown in a dated role)', { exact: false }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Add Design Systems to your profile' }),
    );
    expect(onAdd).toHaveBeenCalledWith('Design Systems');
  });

  it('keeps missing skills as plain chips where the page cannot add them', () => {
    render(<SkillEvidenceList skills={['Design Systems']} profile={profile} label="Required" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('(not on your profile)', { exact: false })).toBeInTheDocument();
  });
});

describe('withoutTitleLine (audit JD-03)', () => {
  it('drops a first line that repeats the title', () => {
    expect(
      withoutTitleLine(
        'Senior Product Designer at Stripe\nYou will join a 12-person team.',
        'Senior Product Designer',
        'Stripe',
      ),
    ).toBe('You will join a 12-person team.');
  });

  it('drops a run-on "title at company — city" lead', () => {
    expect(
      withoutTitleLine(
        'Senior Product Designer at Stripe — Bengaluru You will join a 12-person team.',
        'Senior Product Designer',
        'Stripe',
      ),
    ).toBe('You will join a 12-person team.');
  });

  it('leaves a description that does not start with the title alone', () => {
    const text = 'We are hiring a designer to own onboarding.';
    expect(withoutTitleLine(text, 'Senior Product Designer', 'Stripe')).toBe(text);
  });
});
