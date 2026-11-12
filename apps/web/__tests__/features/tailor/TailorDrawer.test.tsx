import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Job, TailorRun } from '@nextkin/shared/models';
import { repos, resetMockRepos } from '@nextkin/shared/repos';

import { ChangeLog } from '@/features/tailor/components/ChangeLog';
import { Drawer } from '@/ui/Drawer';
import { FlowFooter } from '@/ui/FlowFooter';
import { CreditPill } from '@/ui/CreditPill';

/** Redesign R5d: the tailor flow opens as a drawer over the job, and says what it did. */
describe('Drawer', () => {
  it('slides over the page at the size asked for and names itself', () => {
    render(
      <Drawer open onOpenChange={() => {}} title="Tailor your resume">
        <p>Step one</p>
      </Drawer>,
    );
    const panel = screen.getByRole('dialog', { name: 'Tailor your resume' });
    expect(panel).toHaveClass('z-modal', 'right-0', 'w-full', 'xl:rounded-l-2xl');
    expect(panel).toHaveClass('xl:w-drawer-xl');
    expect(panel).toHaveAttribute('data-drawer');
    expect(within(panel).getByText('Step one')).toBeInTheDocument();
  });

  it('asks to close from its button and from Escape', async () => {
    const onOpenChange = jest.fn();
    render(
      <Drawer open onOpenChange={onOpenChange} title="Tailor your resume">
        <p>Step one</p>
      </Drawer>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close tailor your resume' }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    onOpenChange.mockClear();
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('What changed for this job (audit TL-43)', () => {
  let job: Job;
  beforeEach(async () => {
    resetMockRepos();
    job = await repos.jobs.get('job_google');
  });

  const run = { sourceResumeId: 'res_pd', added: ['Figma'], skipped: ['Sketch'] } as TailorRun;

  it('counts what the run changed and lists what it left out, and why', async () => {
    render(<ChangeLog job={job} run={run} />);
    const summary = screen.getByText('What changed for this job');
    expect(summary.closest('summary')).toHaveTextContent(/\d+ changes/);
    await userEvent.click(summary);
    expect(screen.getByText('Added Figma — you ticked it')).toBeVisible();
    expect(screen.getByText('Sketch left out — you didn’t tick it')).toBeVisible();
  });
});

describe('the cost note under a flow step', () => {
  it('draws the info icon unless the note brings its own', () => {
    const { container, rerender } = render(
      <FlowFooter note="Your data is private.">
        <button type="button">Continue</button>
      </FlowFooter>,
    );
    const icons = () => container.querySelectorAll('svg').length;
    expect(icons()).toBe(1);
    rerender(
      <FlowFooter
        note={<CreditPill state="cost" text="Uses 1 of 3 left this month" />}
        noteIcon={false}
      >
        <button type="button">Continue</button>
      </FlowFooter>,
    );
    // Only the pill's own bolt.
    expect(icons()).toBe(1);
    expect(screen.getByText('Uses 1 of 3 left this month')).toBeInTheDocument();
  });
});
