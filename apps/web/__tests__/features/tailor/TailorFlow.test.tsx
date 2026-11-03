import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';

import { repos, resetMockRepos } from '@nextkin/shared/repos';

import { JobPageScreen } from '@/features/jobs/screens/JobPageScreen';
import { TailorScreen, type TailorScreenProps } from '@/features/tailor/screens/TailorScreen';
import { parseTailorStep } from '@/features/tailor/tailorTarget';
import { SAMPLE_JD } from '@/features/upload/uploadLibrary';
import { Toaster } from '@/ui/Toaster';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

const replace = jest.fn();
const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => '/jobs/job_google/tailor',
  useSearchParams: () => new URLSearchParams(),
}));

const wait = { timeout: SETTLE_MS.normal * 4 };

/**
 * The flow's step lives in the address (`?step=`); the route page reads it into `step`. This
 * stands in for that page: a `push` to another step re-renders the same screen on it, so what was
 * ticked on one step is still ticked on the next, as it is in the app.
 */
let navigate: (href: string) => void = () => {};
function RoutedTailor(props: TailorScreenProps) {
  const [href, setHref] = useState('');
  useEffect(() => {
    navigate = setHref;
  }, []);
  const asked = new URL(href || '/', 'http://nextkin.test').searchParams.get('step');
  return <TailorScreen {...props} step={parseTailorStep(asked) ?? props.step} />;
}

describe('Job page (724:2)', () => {
  beforeEach(() => {
    resetMockRepos();
    push.mockClear();
  });

  it('shows the listing, how you match, and the way into tailoring', async () => {
    renderWithQuery(
      <>
        <JobPageScreen id="job_google" />
        <Toaster />
      </>,
    );
    const page = await screen.findByRole('article', { name: 'Lead UX Designer at Google' }, wait);
    expect(within(page).getByRole('heading', { level: 1, name: 'Lead UX Designer' })).toBeVisible();
    const match = within(page).getByRole('region', { name: 'How well you match' });
    expect(within(match).getByText('98')).toBeInTheDocument();
    expect(within(match).getByText('Experience level')).toBeInTheDocument();
    for (const section of ['Responsibilities', 'Qualifications', 'Benefits', 'Company']) {
      expect(within(page).getByRole('heading', { name: section })).toBeInTheDocument();
    }
    expect(within(page).getByText('Founded 1998')).toBeInTheDocument();
    expect(within(page).getByRole('link', { name: /Apply on company site/ })).toHaveAttribute(
      'href',
      'https://careers.google.com',
    );
  });

  it('adds a missing skill to the profile with one click', async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <>
        <JobPageScreen id="job_google" />
        <Toaster />
      </>,
    );
    const add = await screen.findByRole('button', { name: 'Add UX Design to your profile' }, wait);
    // Enabled once the profile it adds to has loaded.
    await waitFor(() => expect(add).toBeEnabled(), wait);
    await user.click(add);
    expect(await screen.findByText('UX Design added to your profile.', {}, wait)).toBeVisible();
  });
});

describe('Choosing the resume (toreview §110)', () => {
  beforeEach(() => {
    resetMockRepos();
    push.mockClear();
  });

  it('Tailor your resume on the job page goes straight to tailoring (toreview §114)', async () => {
    const user = userEvent.setup();
    renderWithQuery(<JobPageScreen id="job_google" />);
    await user.click(await screen.findByRole('button', { name: /Tailor your resume/ }, wait));
    expect(push).toHaveBeenCalledWith('/jobs/job_google/tailor');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('"Change" asks which resume, with the base first, and takes an upload (toreview §110.4)', async () => {
    const user = userEvent.setup();
    URL.createObjectURL = jest.fn(() => 'blob:resume');
    renderWithQuery(<TailorScreen target={{ kind: 'job', id: 'job_google' }} resumeId="res_pd" />);
    await user.click(await screen.findByRole('button', { name: 'Change' }, wait));
    const dialog = await screen.findByRole('dialog', { name: 'Which resume should we tailor?' });
    expect(within(dialog).getByText(/For Lead UX Designer · Google/)).toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: /Product Designer Resume/ })).toBeChecked();
    const file = new File(['resume'], 'Priya_Raman_Resume.pdf', { type: 'application/pdf' });
    await user.upload(within(dialog).getByLabelText('Resume file'), file);
    // Read, saved to Resumes, and picked in the list above.
    await waitFor(
      () => expect(within(dialog).getByRole('radio', { name: /Priya.Raman.Resume/ })).toBeChecked(),
      { timeout: SETTLE_MS.slow * 3 },
    );
    await user.click(within(dialog).getByRole('button', { name: 'Use this resume' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  }, 30000);

  it('a resume list that fails to load never reads as “no resume yet”', async () => {
    const list = jest.spyOn(repos.resumes, 'list').mockRejectedValue(new Error('offline'));
    renderWithQuery(<TailorScreen target={{ kind: 'job', id: 'job_google' }} />);
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS.error * 2));
    expect(screen.queryByText('Let’s get you a resume for this job')).not.toBeInTheDocument();
    list.mockRestore();
  }, 30000);

  it('arriving without a pick opens on step 2 with nothing chosen and no dialog open (toreview §114, §152, §157, §158)', async () => {
    renderWithQuery(<TailorScreen target={{ kind: 'job', id: 'job_google' }} />);
    const step = await screen.findByRole(
      'region',
      { name: 'How would you like to create your resume?' },
      wait,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // No resume is named until the tailor popup chooses one.
    expect(within(step).queryByText('Product Designer Resume')).not.toBeInTheDocument();
    expect(within(step).getByText('Not chosen yet')).toBeInTheDocument();
    expect(
      within(step).getByRole('radio', { name: 'Tailor my selected resume' }),
    ).not.toBeChecked();
  });
});

describe('Tailor flow (734:2, 734:679)', () => {
  beforeEach(() => {
    resetMockRepos();
    replace.mockClear();
    push.mockReset();
    push.mockImplementation((href: string) => navigate(href));
  });

  it('compares and enhances on one step, then starts a run with only the keywords ticked', async () => {
    const user = userEvent.setup();
    const start = jest.spyOn(repos.generations, 'start');
    renderWithQuery(<RoutedTailor target={{ kind: 'job', id: 'job_google' }} resumeId="res_pd" />);

    // One step after the resume (owner, toreview §149): the job against the resume, with its score.
    const enhance = await screen.findByRole('region', { name: 'Choose what to add' }, wait);
    expect(within(enhance).getByText('Product Designer Resume (base)')).toBeInTheDocument();
    expect(
      within(enhance).getByRole('img', { name: 'ATS score: 5.6 out of 10' }),
    ).toBeInTheDocument();
    expect(within(enhance).getByRole('button', { name: 'Change' })).toBeInTheDocument();

    // The plan lives in the step itself (toreview §161): no old fix-plan table, and only where the
    // points go is a link away.
    expect(within(enhance).queryByRole('heading', { name: 'Your fix plan' })).toBeNull();
    const pointsLink = within(enhance).getByRole('button', { name: 'See where your points go' });
    await user.click(pointsLink);
    expect(pointsLink).toHaveAttribute('aria-expanded', 'true');
    expect(within(enhance).getByRole('list', { name: 'Your score by part' })).toBeInTheDocument();
    await user.click(within(enhance).getByRole('button', { name: 'Figma' }));
    expect(within(enhance).getByRole('button', { name: 'Figma' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: /Create my resume/ }));
    await waitFor(
      () =>
        expect(replace).toHaveBeenCalledWith(
          expect.stringMatching(/^\/jobs\/job_google\/tailor\?run=.+&resumeId=res_pd$/),
        ),
      wait,
    );
    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0]![0].tailor?.added).toEqual(['Figma']);
    start.mockRestore();
  }, 20000);

  it('ticks take the places picked from the resume, several if you like (toreview §163)', async () => {
    const user = userEvent.setup();
    const start = jest.spyOn(repos.generations, 'start');
    renderWithQuery(<RoutedTailor target={{ kind: 'job', id: 'job_google' }} resumeId="res_pd" />);
    const enhance = await screen.findByRole('region', { name: 'Choose what to add' }, wait);
    expect(within(enhance).queryByText('Already on your resume')).toBeNull();

    // Figma fits no line of this resume: a skills-list tick, with no row to place it.
    await user.click(within(enhance).getByRole('button', { name: 'Figma' }));
    expect(within(enhance).queryByRole('button', { name: /AI adds it to|Skills only/ })).toBeNull();

    // User Research fits the Google role: the tick shows where the AI adds it.
    await user.click(within(enhance).getByRole('button', { name: 'User Research' }));
    const picker = within(enhance).getByRole('button', {
      name: 'AI adds it to: Software Engineer · Google',
    });
    await user.click(picker);
    await user.click(
      await screen.findByRole('menuitemcheckbox', {
        name: 'Software Development Engineer · Adobe',
      }),
    );
    await user.keyboard('{Escape}');
    expect(
      within(enhance).getByRole('button', { name: 'Used in: Software Engineer · Google +1' }),
    ).toBeInTheDocument();

    // Results are their own card, outside the keyword step.
    const results = screen.getByRole('region', { name: 'Add real results' });
    expect(enhance).not.toContainElement(results);

    await user.click(screen.getByRole('button', { name: /Create my resume/ }));
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1), wait);
    expect(start.mock.calls[0]![0].tailor?.confirmed).toEqual([
      { keyword: 'User Research', where: 'role_google', by: 'you' },
      { keyword: 'User Research', where: 'role_adobe', by: 'you' },
    ]);
    start.mockRestore();
  }, 30000);

  it('opens an old step 3 link on Enhance', async () => {
    renderWithQuery(
      <TailorScreen
        target={{ kind: 'job', id: 'job_google' }}
        resumeId="res_pd"
        step={parseTailorStep('compare')}
      />,
    );
    expect(
      await screen.findByRole('region', { name: 'Choose what to add' }, wait),
    ).toBeInTheDocument();
  }, 20000);

  it('tailors to a job description the user brought', async () => {
    const user = userEvent.setup();
    const draft = await repos.jd.extract({ source: 'paste', text: SAMPLE_JD });
    renderWithQuery(<RoutedTailor target={{ kind: 'jd', id: draft.id }} resumeId="res_pd" />);
    const enhance = await screen.findByRole('region', { name: 'Choose what to add' }, wait);
    expect(within(enhance).getAllByText(new RegExp(draft.title)).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /Create my resume/ }));
    await waitFor(
      () =>
        expect(replace).toHaveBeenCalledWith(
          expect.stringContaining(`/jd/${draft.id}/tailor?run=`),
        ),
      wait,
    );
  }, 20000);
});
