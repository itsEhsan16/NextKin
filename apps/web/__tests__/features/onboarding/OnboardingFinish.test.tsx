import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

import type { MockMode } from '@nextkin/shared/mock';
import { repos, resetMockRepos } from '@nextkin/shared/repos';

import { entryFromEducation } from '@/features/onboarding/education';
import { useOnboardingStore } from '@/features/onboarding/onboardingStore';
import { DoneScreen } from '@/features/onboarding/screens/DoneScreen';
import { EducationStepScreen } from '@/features/onboarding/screens/EducationStepScreen';
import { startingSummary } from '@/features/onboarding/startingPoint';
import { studyDates } from '@/features/profile/profileLibrary';
import { renderInFrame, row, wait } from '../../../testSupport/onboarding';
import { SETTLE_MS } from '../../../testSupport/render';

/** Web onboarding ONB 07 and 08: education and the starting point (808:266, 808:348; `toreview.md` §107.4). */

const push = jest.fn();
let pathname = '/onboarding/education';
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathname,
}));

jest.setTimeout(20_000);

function renderStep(path: string, ui: ReactElement, mode?: MockMode) {
  pathname = path;
  return renderInFrame(ui, mode);
}

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, SETTLE_MS.normal)));

describe('Web onboarding · finish', () => {
  beforeEach(() => {
    resetMockRepos();
    useOnboardingStore.getState().reset();
    push.mockClear();
  });

  describe('ONB 07 · education', () => {
    it('starts from the latest qualification and saves a year-only end', async () => {
      const user = userEvent.setup();
      const before = await repos.profile.getProfile();
      const latest = before.education[0];
      renderStep('/onboarding/education', <EducationStepScreen />);
      expect(screen.getByText('A few quick questions · 3 of 3')).toBeInTheDocument();

      const degree = await screen.findByLabelText('Degree', {}, wait);
      await waitFor(
        () =>
          expect(degree).toHaveValue(
            latest?.field ? `${latest.degree}, ${latest.field}` : latest?.degree,
          ),
        wait,
      );
      expect(screen.getByLabelText('School or university')).toHaveValue(latest?.institution);
      const year = latest?.endDate?.slice(0, 4) ?? '';
      expect(screen.getByRole('button', { name: `Year finished ${year}` })).toBeInTheDocument();
      expect(within(row('Education')).getByText(new RegExp(`${year}$`))).toBeInTheDocument();

      await user.clear(screen.getByLabelText('School or university'));
      await user.type(screen.getByLabelText('School or university'), 'NID Ahmedabad');
      await user.click(screen.getByRole('button', { name: /^Year finished/ }));
      await user.click(await screen.findByRole('menuitem', { name: '2017' }));
      expect(within(row('Education')).getByText(/NID Ahmedabad, 2017$/)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Create my starting point/ }));
      expect(push).toHaveBeenCalledWith('/onboarding/done');
      await waitFor(async () => {
        const saved = (await repos.profile.getProfile()).education.find((e) => e.id === latest?.id);
        expect(saved).toMatchObject({
          institution: 'NID Ahmedabad',
          endDate: '2017-12-31',
          endPrecision: 'year',
          startDate: '',
        });
      }, wait);
      await settle();
    });

    it('needs degree and school once begun, and skips without saving', async () => {
      const user = userEvent.setup();
      const before = await repos.profile.getProfile();
      renderStep('/onboarding/education', <EducationStepScreen />);
      const degree = await screen.findByLabelText('Degree', {}, wait);
      await waitFor(() => expect(degree).not.toHaveValue(''), wait);

      await user.clear(degree);
      expect(screen.getByRole('button', { name: /Create my starting point/ })).toBeDisabled();

      await user.click(screen.getByRole('button', { name: /Skip this question/ }));
      expect(push).toHaveBeenCalledWith('/onboarding/done');
      expect((await repos.profile.getProfile()).education).toEqual(before.education);
    });
  });

  describe('ONB 08 · starting point', () => {
    it('sums up only the answers, as a draft, with the next steps', async () => {
      const user = userEvent.setup();
      useOnboardingStore.setState({
        name: 'George Smith',
        goal: 'better_role',
        targetRole: 'Lead UX Designer',
        experience: '6_10',
        roles: [
          {
            id: 'r1',
            title: 'Senior UX Designer',
            company: 'Flipkart',
            from: '2022-03',
            to: 'present',
            skills: [],
          },
        ],
        skills: ['User research', 'Design systems', 'Figma', 'Prototyping', 'Usability testing'],
      });
      renderStep('/onboarding/done', <DoneScreen />);

      expect(screen.getByText('All done')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Skip for now' })).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Your profile so far' })).not.toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 1, name: 'Here’s your starting point, George' }),
      ).toBeInTheDocument();

      const card = screen.getByRole('region', { name: 'Your starting point' });
      expect(
        within(card).getByText('Senior UX Designer → aiming for Lead UX Designer'),
      ).toBeVisible();
      expect(
        within(card).getByText(
          'Senior UX Designer with 6–10 years of experience, most recently at Flipkart. Works across User research, Design systems and Figma, and is looking for a Lead UX Designer role.',
        ),
      ).toBeInTheDocument();
      expect(within(card).getByRole('link', { name: /Draft · check it/ })).toHaveAttribute(
        'href',
        '/profile',
      );
      expect(within(card).getAllByRole('listitem')).toHaveLength(5);

      expect(screen.getByRole('link', { name: /Add a job you want/ })).toHaveAttribute(
        'href',
        '/upload-jd',
      );
      expect(screen.getByRole('img', { name: 'Done' })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Go to my dashboard/ }));
      expect(push).toHaveBeenCalledWith('/');
      await settle();
    });

    it('falls back to the saved profile after a reload', async () => {
      const profile = await repos.profile.getProfile();
      renderStep('/onboarding/done', <DoneScreen />);
      const card = await screen.findByRole('region', { name: 'Your starting point' }, wait);
      await waitFor(() => expect(within(card).getByText(/George/)).toBeInTheDocument(), wait);
      const first = profile.skills[0] ?? '';
      expect(within(card).getByText(first)).toBeInTheDocument();
      await settle();
    });
  });

  describe('summaries and dates', () => {
    it('drops a clause it has no answer for, rather than guessing', () => {
      expect(startingSummary({ skills: [] })).toBe('');
      expect(startingSummary({ skills: [], goal: 'exploring' })).toBe('Exploring what’s next.');
      expect(startingSummary({ title: 'Designer', band: 'new_grad', skills: ['Figma'] })).toBe(
        'Designer at the start of their career. Works across Figma.',
      );
      expect(
        startingSummary({ band: '10_plus', company: 'Acme', skills: [], goal: 'new_field' }),
      ).toBe(
        'More than 10 years of experience, most recently at Acme. Looking to move into a new field.',
      );
    });

    it('stores a year finished as a year-precise end, and prints it as the year', () => {
      const entry = entryFromEducation({
        id: 'edu_new_x',
        degree: 'B.Des, Interaction Design',
        school: 'NID Ahmedabad',
        year: '2017',
      });
      expect(entry).toMatchObject({
        degree: 'B.Des',
        field: 'Interaction Design',
        institution: 'NID Ahmedabad',
        startDate: '',
        endDate: '2017-12-31',
        endPrecision: 'year',
      });
      expect(studyDates(entry.startDate, entry.endDate, entry.current, entry.endPrecision)).toBe(
        '2017',
      );
      expect(studyDates('2013-07-01', '2017-12-31', false, 'year')).toBe('Jul 2013 – 2017');
      expect(studyDates('2013-07-01', '2017-05-31', false)).toBe('Jul 2013 – May 2017');
    });
  });
});
