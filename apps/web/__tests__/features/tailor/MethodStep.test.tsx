import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetMockRepos } from '@nextkin/shared/repos';

import { TailorScreen } from '@/features/tailor/screens/TailorScreen';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push }),
  usePathname: () => '/jobs/job_google/tailor',
  useSearchParams: () => new URLSearchParams(),
}));

const wait = { timeout: SETTLE_MS.normal * 4 };
const target = { kind: 'job', id: 'job_google' } as const;

async function openOnMethod() {
  renderWithQuery(<TailorScreen target={target} resumeId="res_pd" step="resume" />);
  return screen.findByRole('radiogroup', { name: 'How to create it' }, wait);
}

describe('How would you like to create your resume? (toreview §151)', () => {
  beforeEach(() => {
    resetMockRepos();
    push.mockClear();
  });

  it('offers four ways, the picked resume first, and shows the selections', async () => {
    const ways = await openOnMethod();
    const radios = within(ways).getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-label'))).toEqual([
      'Tailor my selected resume',
      'Create from my profile',
      'Start from scratch with AI',
      'Upload a resume',
    ]);
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit job' })).toBeInTheDocument();
  });

  it('Edit beside the starting resume opens the resume chooser', async () => {
    const user = userEvent.setup();
    await openOnMethod();
    await user.click(screen.getByRole('button', { name: 'Edit starting resume' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('Continue opens the tailor popup, which goes on to Enhance', async () => {
    const user = userEvent.setup();
    await openOnMethod();
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Tailor my selected resume' });
    expect(within(dialog).getByText('Selected resume')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /Tailor Resume/ }));
    expect(push).toHaveBeenCalledWith('/jobs/job_google/tailor?resumeId=res_pd&step=enhance');
  });

  it('the scratch popup names the three questions; Cancel closes it', async () => {
    const user = userEvent.setup();
    const ways = await openOnMethod();
    await user.click(within(ways).getByRole('radio', { name: 'Start from scratch with AI' }));
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Start from scratch with AI' });
    expect(
      within(dialog).getByText('Your name · Years of experience · The role you want'),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('the upload popup waits for a file before it can go on', async () => {
    const user = userEvent.setup();
    const ways = await openOnMethod();
    await user.click(within(ways).getByRole('radio', { name: 'Upload a resume' }));
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Upload a resume' });
    const go = within(dialog).getByRole('button', { name: /Upload & Continue/ });
    expect(go).toBeDisabled();
    await user.upload(
      within(dialog).getByLabelText('Resume file'),
      new File(['%PDF'], 'me.pdf', { type: 'application/pdf' }),
    );
    expect(within(dialog).getByText('me.pdf')).toBeInTheDocument();
    expect(go).toBeEnabled();
  });

  it('the profile popup counts what the profile holds', async () => {
    const user = userEvent.setup();
    const ways = await openOnMethod();
    await user.click(within(ways).getByRole('radio', { name: 'Create from my profile' }));
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Create from my profile' });
    expect(
      await within(dialog).findByText(/^Experience \(\d+\) · Education \(\d+\) · Skills \(\d+\)$/),
    ).toBeInTheDocument();
  });
});
