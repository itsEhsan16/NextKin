import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetMockRepos } from '@nextkin/shared/repos';

import { RubricScreen } from '@/features/admin/content/screens/RubricScreen';
import { SkillsScreen } from '@/features/admin/content/screens/SkillsScreen';
import { TemplatesScreen } from '@/features/admin/content/screens/TemplatesScreen';
import { renderWithQuery, SETTLE_MS } from '../../../../testSupport/render';

jest.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ push: jest.fn() }),
}));

const wait = { timeout: SETTLE_MS.normal * 4 };

describe('Skills & aliases (Figma 406:1829)', () => {
  beforeEach(() => resetMockRepos());

  it('lists Cloud & DevOps and merges a suggested alias', async () => {
    const user = userEvent.setup();
    renderWithQuery(<SkillsScreen />);

    const table = await screen.findByRole('table', {}, wait);
    expect(within(table).getByText('Kubernetes')).toBeInTheDocument();
    expect(within(table).getByText('No aliases')).toBeInTheDocument();
    expect(await screen.findByText('Cloud & DevOps · 412 skills', {}, wait)).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 52')).toBeInTheDocument();

    // The stat card shares the name; the list is the second region.
    const merges = screen.getAllByRole('region', { name: 'Merge suggestions' })[1]!;
    expect(within(merges).getByText(/Showing 4 of 6/)).toBeInTheDocument();
    await user.click(within(merges).getByRole('button', { name: 'Merge ReactJS into React' }));
    await waitFor(
      () => expect(within(merges).getByText(/Showing 4 of 5/)).toBeInTheDocument(),
      wait,
    );
    expect(within(merges).getByRole('button', { name: 'Dismiss Postgres' })).toBeInTheDocument();
  });

  it('maps a term to a skill outside the open category', async () => {
    const user = userEvent.setup();
    renderWithQuery(<SkillsScreen />);

    await user.click(await screen.findByRole('button', { name: 'Map Pulumi' }, wait));
    const dialog = await screen.findByRole('dialog', { name: 'Map “Pulumi”' });
    await user.type(within(dialog).getByRole('searchbox'), 'postgres');
    await user.click(await within(dialog).findByRole('radio', { name: /PostgreSQL/ }, wait));
    await user.click(within(dialog).getByRole('button', { name: 'Map as alias' }));
    await waitFor(
      () => expect(screen.queryByRole('dialog', { name: 'Map “Pulumi”' })).not.toBeInTheDocument(),
      wait,
    );
  });

  it('starts Add skill on the category being viewed', async () => {
    const user = userEvent.setup();
    renderWithQuery(<SkillsScreen />);

    await user.click(await screen.findByRole('button', { name: /Data & AI/ }, wait));
    await user.click(screen.getByRole('button', { name: 'Add skill' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a skill' });
    expect(within(dialog).getByRole('radio', { name: 'Data & AI' })).toBeChecked();
  });
});

describe('Templates (Figma 407:1841)', () => {
  beforeEach(() => resetMockRepos());

  it('won’t publish an uncertified template, and publishes a certified one', async () => {
    const user = userEvent.setup();
    renderWithQuery(<TemplatesScreen />);

    expect(await screen.findByText('In use by 8,214 resumes', {}, wait)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Publish Executive' })).toBeDisabled();
    expect(screen.getByText('Awaits sign-off')).toBeInTheDocument();
    // No sample render exists yet, so the preview says it's coming rather than faking one.
    expect(screen.getByRole('button', { name: 'Preview Jake with sample data' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    const classic = screen.getByRole('switch', { name: 'Publish Classic' });
    expect(classic).toHaveAttribute('aria-checked', 'false');
    await user.click(classic);
    await waitFor(
      () =>
        expect(screen.getByRole('switch', { name: 'Publish Classic' })).toHaveAttribute(
          'aria-checked',
          'true',
        ),
      wait,
    );
  });
});

describe('ATS rubric (Figma 408:3123)', () => {
  beforeEach(() => resetMockRepos());

  it('shows v4’s changes against v3 and holds it until sign-off', async () => {
    const user = userEvent.setup();
    renderWithQuery(<RubricScreen />);

    expect(await screen.findByText('Criteria · v4 draft', {}, wait)).toBeInTheDocument();
    expect(screen.getByText('Weights total 100%')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'v3 → v4' })).toBeInTheDocument();
    expect(screen.getAllByText('unchanged')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Publish v4' }));
    const dialog = await screen.findByRole('dialog', { name: 'Publish rubric v4?' });
    expect(within(dialog).getByText(/admin sign-off is still pending/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Publish v4' })).toBeDisabled();
  });

  it('compares v3 with v4 weight by weight, and names the draft when viewing v1', async () => {
    const user = userEvent.setup();
    renderWithQuery(<RubricScreen />);

    await user.click(await screen.findByRole('button', { name: 'Compare versions' }, wait));
    const dialog = await screen.findByRole('dialog', { name: 'v3 against v4' });
    expect(within(dialog).getByRole('columnheader', { name: 'v3' })).toBeInTheDocument();
    expect(within(dialog).getByRole('columnheader', { name: 'v4' })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('radio', { name: /v1/ }));
    expect(await screen.findByText('Rationale & evidence · v4 draft')).toBeInTheDocument();
  });
});
