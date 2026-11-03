import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Resume } from '@nextkin/shared/models';
import { resetMockRepos } from '@nextkin/shared/repos';

import { JobFlowScreen } from '@/features/create/jobFlow/JobFlowScreen';
import { ResumePicker } from '@/features/tailor/flow/ResumePicker';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: jest.fn() }),
  usePathname: () => '/create/build',
  useSearchParams: () => new URLSearchParams(),
}));

const wait = { timeout: SETTLE_MS.normal * 4 };

const resume = (i: number, over: Partial<Resume> = {}): Resume =>
  ({
    id: `r${i}`,
    title: `Resume ${String(i).padStart(2, '0')}`,
    docType: 'resume',
    status: 'ready',
    updatedAt: new Date(2026, 9, i).toISOString(),
    createdAt: new Date(2026, 9, i).toISOString(),
    ...over,
  }) as Resume;

describe('the redesigned start screens (toreview §150)', () => {
  beforeEach(() => {
    resetMockRepos();
    push.mockClear();
  });

  it('shows saved jobs four a page, with how many there are', async () => {
    const user = userEvent.setup();
    renderWithQuery(<JobFlowScreen flow="tailor" />);
    const list = await screen.findByRole('radiogroup', { name: 'Your saved jobs' }, wait);
    expect(within(list).getAllByRole('radio').length).toBeLessThanOrEqual(4);
    const pages = screen.queryByRole('navigation', { name: 'Saved job pages' });
    if (pages) {
      const before = within(list).getAllByRole('radio')[0]!.textContent;
      await user.click(within(pages).getByRole('button', { name: 'Next page' }));
      expect(within(list).getAllByRole('radio')[0]!.textContent).not.toBe(before);
    }
    expect(screen.getByText(/^Showing \d+ of \d+ jobs$/)).toBeInTheDocument();
  });

  it('adds a job from its link with Analyze job', async () => {
    const user = userEvent.setup();
    renderWithQuery(<JobFlowScreen flow="tailor" />);
    await screen.findByRole('radiogroup', { name: 'Your saved jobs' }, wait);
    const analyze = screen.getByRole('button', { name: /Analyze job/ });
    expect(analyze).toBeDisabled();
    await user.click(screen.getByRole('tab', { name: /Paste job link/ }));
    await user.type(
      screen.getByRole('textbox', { name: 'Job link' }),
      'https://jobs.lever.co/acme/1',
    );
    await user.click(analyze);
    await waitFor(
      () => expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/jd\/.+\/tailor/)),
      wait,
    );
  });

  it('keeps every way to add a job in one box, so switching never resizes it (toreview §156)', async () => {
    const user = userEvent.setup();
    renderWithQuery(<JobFlowScreen flow="build" />);
    await screen.findByRole('radiogroup', { name: 'Your saved jobs' }, wait);
    const paste = screen.getByRole('textbox', { name: 'Job description or link' });
    await user.click(screen.getByRole('tab', { name: /Paste job link/ }));
    // The paste box stays in place, unseen and out of reach, holding the box's height.
    expect(paste.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(paste.closest('[inert]')).not.toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Job description or link' })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Job link' })).toBeVisible();
  });

  it('lists resumes five a page, splits yours from all, sorts and searches', async () => {
    const user = userEvent.setup();
    const list = [
      ...Array.from({ length: 6 }, (_, i) => resume(i + 1)),
      resume(9, { title: 'Tailored for Acme', targetCompany: 'Acme' }),
    ];
    renderWithQuery(
      <ResumePicker
        resumes={list}
        loading={false}
        failed={false}
        onRetry={jest.fn()}
        value="r1"
        onPick={jest.fn()}
      />,
    );
    const group = () => screen.getByRole('radiogroup', { name: 'Your resumes' });
    expect(within(group()).getAllByRole('radio')).toHaveLength(5);
    expect(screen.getByText('Showing 5 of 6 resumes')).toBeInTheDocument();
    // Newest first: Resume 06 leads.
    expect(within(group()).getAllByRole('radio')[0]).toHaveAccessibleName('Resume 06');

    await user.click(screen.getByRole('tab', { name: /All resumes/ }));
    expect(screen.getByText('Showing 5 of 7 resumes')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Sort:/ }));
    await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Name A–Z' }));
    expect(within(group()).getAllByRole('radio')[0]).toHaveAccessibleName('Resume 01');

    await user.type(screen.getByRole('searchbox', { name: 'Search resumes' }), 'acme');
    expect(within(group()).getAllByRole('radio')).toHaveLength(1);
  });
});
