import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetMockRepos } from '@nextkin/shared/repos';

import { durationLabel } from '@/features/profile/profileLibrary';
import { ProfileScreen } from '@/features/profile/screens/ProfileScreen';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

const TABS = [
  'Overview',
  'Experience',
  'Education',
  'Skills',
  'Career preferences',
  'Social links',
];

/** Resolves once the profile has loaded; the completion ring sits beside every section. */
const settle = () =>
  // The ring counts the checklist (redesign R7b, PF-03): George's seven items are all done.
  screen.findByRole('img', { name: 'Profile completion: 100%' }, { timeout: SETTLE_MS.normal * 2 });

const card = (name: string) => screen.getByRole('region', { name });

/** A checklist row and whether it reads as done (`, done` / `, to do` for screen readers). */
const checklistRow = (label: string) =>
  within(screen.getByRole('list', { name: 'Profile checklist' }))
    .getByText(label)
    .closest('li');

describe('ProfileScreen', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  it('renders the board copy', () => {
    renderWithQuery(<ProfileScreen />);

    expect(screen.getByRole('heading', { level: 1, name: 'Your profile' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Showcase your skills, experience, and aspirations. A stronger profile leads to better opportunities.',
      ),
    ).toBeInTheDocument();
    for (const name of TABS) expect(screen.getByRole('tab', { name })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Overview', selected: true })).toBeInTheDocument();
  });

  it('shows the loading state before the mock layer settles', () => {
    renderWithQuery(<ProfileScreen />);
    expect(screen.queryByRole('heading', { name: 'George Smith' })).not.toBeInTheDocument();
  });

  it("fills Overview with the board's George", async () => {
    renderWithQuery(<ProfileScreen />);
    await settle();

    const info = card('Profile information');
    expect(within(info).getByText('UX Designer')).toBeInTheDocument();
    expect(within(info).getByText('Open to opportunities')).toBeInTheDocument();
    const contact = within(info).getByRole('list', { name: 'Contact details' });
    for (const line of [
      'Bengaluru, India',
      '+91 98765 43210',
      'george.smith@gmail.com',
      'georgesmith.design',
      'linkedin.com/in/georgesmith',
    ]) {
      expect(within(contact).getByText(line)).toBeInTheDocument();
    }
    expect(
      within(info).getByText('“Designing human experiences for a better tomorrow.”'),
    ).toBeInTheDocument();

    expect(
      within(card('About me')).getByText(/^Passionate UX Designer with 4\+ years of experience/),
    ).toBeInTheDocument();

    const experience = card('Experience');
    for (const text of [
      'Senior Product Designer',
      'Google',
      'Leading the design of AI-powered tools used by millions of users.',
      'Product Designer',
      'Figma',
      "Designed collaborative features for Figma's web platform.",
    ]) {
      expect(within(experience).getByText(text)).toBeInTheDocument();
    }
    expect(
      within(experience).getByText(/^Jun 2020 – Dec 2021\s+·\s+1\.5 years$/),
    ).toBeInTheDocument();

    const key = card('Key information');
    for (const [label, value] of [
      ['Job title', 'UX Designer'],
      ['Experience', '3–5 years'],
      // Read off the Google role, where the board still prints "Not specified" (toreview.md §91).
      ['Current company', 'Google'],
      ['Education', 'B.Tech in Design'],
      ['Location', 'Bengaluru, India'],
      ['Preferred job type', 'Full-time, Hybrid'],
    ] as const) {
      expect(within(key).getByText(label).nextElementSibling).toHaveTextContent(value);
    }

    const skills = within(card('Skills')).getAllByRole('listitem');
    expect(skills.map((chip) => chip.textContent)).toEqual([
      'UI/UX Design',
      'Figma',
      'User Research',
      'Design Systems',
      'Prototyping',
      'Product Strategy',
      'Usability Testing',
      '+3 more',
    ]);

    const preferences = card('Career preferences');
    for (const [label, value] of [
      ['Desired role', 'Product Designer'],
      ['Preferred location', 'Bengaluru, Remote'],
      ['Job type', 'Full-time'],
    ] as const) {
      expect(within(preferences).getByText(label).nextElementSibling).toHaveTextContent(value);
    }

    const links = card('Social links');
    expect(
      within(links).getByRole('link', { name: /linkedin\.com\/in\/georgesmith/ }),
    ).toHaveAttribute('href', 'https://linkedin.com/in/georgesmith');
    expect(within(links).getByRole('link', { name: /georgesmith\.design/ })).toHaveAttribute(
      'href',
      'https://georgesmith.design',
    );

    for (const name of [
      'profile information',
      'about me',
      'key information',
      'career preferences',
      'social links',
    ]) {
      expect(screen.getByRole('button', { name: `Edit ${name}` })).toBeInTheDocument();
    }
  });

  it('shows completion, the AI suggestions and the nudge on the right', async () => {
    renderWithQuery(<ProfileScreen />);
    await settle();

    for (const done of [
      'Basic information',
      'Contact details',
      'Location',
      'Add a bio',
      'Add work experience',
      // The LinkedIn listed under Social links counts (PF-03).
      'Add your LinkedIn',
    ]) {
      expect(checklistRow(done)).toHaveTextContent(', done');
    }

    const suggestions = card('AI profile suggestions');
    for (const name of [
      'Add 2–3 more skills',
      'Write a stronger summary',
      'Highlight measurable impact in your experience',
      'View all suggestions',
    ]) {
      expect(within(suggestions).getByRole('link', { name })).toHaveAttribute('href', '/assistant');
    }
    // Nothing suggested that is already there: George lists a portfolio (PF-03).
    expect(within(suggestions).queryByRole('link', { name: 'Add a portfolio link' })).toBeNull();
    expect(screen.getByText('Ready for more opportunities?')).toBeInTheDocument();
    // No unsourced recruiter claim (PF-04).
    expect(screen.queryByText(/3x more views/)).toBeNull();
  });

  it('opens a section from its tab and from View all', async () => {
    const user = userEvent.setup();
    renderWithQuery(<ProfileScreen />);
    await settle();

    await user.click(screen.getByRole('button', { name: 'View all skills' }));
    expect(screen.getByRole('tab', { name: 'Skills', selected: true })).toBeInTheDocument();
    expect(within(card('Skills')).getAllByRole('listitem')).toHaveLength(10);
    expect(screen.queryByRole('region', { name: 'About me' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Education' }));
    const education = card('Education');
    expect(within(education).getByText('B.Tech in Design')).toBeInTheDocument();
    expect(within(education).getByText('Anna University')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Overview' }));
    await user.click(screen.getByRole('button', { name: 'Manage experience' }));
    expect(screen.getByRole('tab', { name: 'Experience', selected: true })).toBeInTheDocument();
  });

  it('opens the section it is asked for on arrival', async () => {
    renderWithQuery(<ProfileScreen initialTab="links" />);
    await settle();

    expect(screen.getByRole('tab', { name: 'Social links', selected: true })).toBeInTheDocument();
    expect(card('Social links')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Profile information' })).not.toBeInTheDocument();
  });

  it('shows the page-level error state when the profile fails to load', async () => {
    renderWithQuery(<ProfileScreen />, 'error');

    expect(
      await screen.findByText('Something went wrong', {}, { timeout: SETTLE_MS.error }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('durationLabel', () => {
  it('states a role the way the board does', () => {
    expect(durationLabel(18)).toBe('1.5 years');
    expect(durationLabel(24)).toBe('2 years');
    expect(durationLabel(29)).toBe('2+ years');
    expect(durationLabel(13)).toBe('1+ year');
    expect(durationLabel(8)).toBe('8 months');
  });
});
