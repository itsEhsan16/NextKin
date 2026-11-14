import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ResumeSyncStatus } from '@nextkin/shared/models';
import { repos, resetMockRepos } from '@nextkin/shared/repos';

import { changeRows, ResumeSyncHost } from '@/features/profile/components/ResumeSyncHost';
import { renderWithQuery } from '../../../testSupport/render';

/** The profile, filled from the base resume: silently the first time, then a yes or no per change. */

let pathname = '/home';
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => pathname,
}));

jest.setTimeout(20_000);

const changes = {
  roles: 2,
  education: 0,
  skills: 5,
  certifications: 0,
  projects: 1,
  links: 1,
  updates: 1,
  fields: ['phone', 'location'] as ('phone' | 'location')[],
};

const status = (state: ResumeSyncStatus['state']): ResumeSyncStatus => ({
  state,
  resumeId: 'r1',
  versionId: 'v2',
  resumeTitle: 'Mohammad Resume',
  changes,
});

describe('ResumeSyncHost', () => {
  let current: ResumeSyncStatus;
  let decide: jest.SpyInstance;

  beforeEach(() => {
    resetMockRepos();
    pathname = '/home';
    jest.spyOn(repos.profile, 'getResumeSync').mockImplementation(async () => current);
    decide = jest.spyOn(repos.profile, 'decideResumeSync').mockImplementation(async () => {
      current = { state: 'current' };
      return repos.profile.getProfile();
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('lists what would be added, one line per kind', () => {
    expect(changeRows(changes).map((row) => row.label)).toEqual([
      '2 new roles',
      'More detail on 1 entry',
      '5 new skills',
      '1 project',
      '1 link',
      'Phone and location',
    ]);
  });

  it('fills the profile the first time without asking', async () => {
    current = status('first');
    renderWithQuery(<ResumeSyncHost />);
    await waitFor(() => expect(decide).toHaveBeenCalledWith({ versionId: 'v2', accept: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('asks when the base resume changed, and Yes fills it', async () => {
    const user = userEvent.setup();
    current = status('changed');
    renderWithQuery(<ResumeSyncHost />);
    const dialog = await screen.findByRole('dialog', { name: 'Add your resume updates to your profile?' });
    expect(dialog).toHaveTextContent('Mohammad Resume');
    expect(dialog).toHaveTextContent('2 new roles');
    expect(dialog).toHaveTextContent('Nothing you’ve typed is changed');
    await user.click(screen.getByRole('button', { name: 'Yes, add them' }));
    await waitFor(() => expect(decide).toHaveBeenCalledWith({ versionId: 'v2', accept: true }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('No is remembered for that version', async () => {
    const user = userEvent.setup();
    current = status('changed');
    renderWithQuery(<ResumeSyncHost />);
    await user.click(await screen.findByRole('button', { name: 'No' }));
    await waitFor(() => expect(decide).toHaveBeenCalledWith({ versionId: 'v2', accept: false }));
  });

  it('waits while the person is editing the resume', async () => {
    pathname = '/resumes/r1/edit';
    current = status('changed');
    renderWithQuery(<ResumeSyncHost />);
    await waitFor(() => expect(repos.profile.getResumeSync).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
