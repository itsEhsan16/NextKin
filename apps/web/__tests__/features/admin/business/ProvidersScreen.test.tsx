import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetMockRepos } from '@nextkin/shared/repos';

import { ProvidersScreen } from '@/features/admin/business/screens/ProvidersScreen';
import { Toaster } from '@/ui/Toaster';
import { renderWithQuery, SETTLE_MS } from '../../../../testSupport/render';

function WithToaster({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}

const wait = { timeout: SETTLE_MS.normal * 3 };

describe('ProvidersScreen (Figma 408:3596)', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  it('draws each provider as the board does', async () => {
    renderWithQuery(
      <WithToaster>
        <ProvidersScreen />
      </WithToaster>,
    );

    const adzuna = await screen.findByRole('region', { name: 'Adzuna' }, wait);
    expect(within(adzuna).getByText('Degraded')).toBeInTheDocument();
    expect(within(adzuna).getByText('6,200 of 10,000 calls')).toBeInTheDocument();
    expect(
      within(adzuna).getByText('Added Oct 12 by Ehsan · write-only, never shown'),
    ).toBeInTheDocument();
    expect(within(adzuna).getByText('4.1%')).toBeInTheDocument();

    const remotive = screen.getByRole('region', { name: 'Remotive' });
    expect(
      within(remotive).getByText('Remote roles · paused by Ana L. on Oct 30'),
    ).toBeInTheDocument();
    expect(within(remotive).getByText('n/a')).toBeInTheDocument();
    expect(within(remotive).getByRole('switch')).not.toBeChecked();
  });

  it('pauses a provider from its switch', async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <WithToaster>
        <ProvidersScreen />
      </WithToaster>,
    );

    const jooble = await screen.findByRole('region', { name: 'Jooble' }, wait);
    await user.click(within(jooble).getByRole('switch', { name: 'Jooble on' }));
    expect(await within(jooble).findByText('Paused', {}, wait)).toBeInTheDocument();
    expect(await screen.findByText('Jooble paused', {}, wait)).toBeInTheDocument();
  });

  it('takes a key write-only and never shows it back', async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <WithToaster>
        <ProvidersScreen />
      </WithToaster>,
    );

    const usajobs = await screen.findByRole('region', { name: 'USAJobs' }, wait);
    await user.click(within(usajobs).getByRole('button', { name: 'Replace the USAJobs key' }));
    const dialog = await screen.findByRole('dialog', { name: 'Replace the USAJobs key' });
    const field = within(dialog).getByLabelText(/API key/);
    expect(field).toHaveAttribute('type', 'password');
    await user.type(field, 'usa-live-secret-0001');
    await user.click(within(dialog).getByRole('button', { name: 'Save key' }));

    expect(await screen.findByText('USAJobs key saved', {}, wait)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('usa-live-secret-0001');
  });

  it('saves a new daily ceiling when the field is left', async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <WithToaster>
        <ProvidersScreen />
      </WithToaster>,
    );

    const adzuna = await screen.findByRole('region', { name: 'Adzuna' }, wait);
    const ceiling = within(adzuna).getByRole('textbox', { name: 'Adzuna daily ceiling' });
    await user.clear(ceiling);
    await user.type(ceiling, '12000{Enter}');
    expect(
      await screen.findByText('Adzuna’s daily ceiling is 12,000 calls', {}, wait),
    ).toBeInTheDocument();
  });

  it('says what a ceiling needs when it isn’t a number', async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <WithToaster>
        <ProvidersScreen />
      </WithToaster>,
    );

    const jooble = await screen.findByRole('region', { name: 'Jooble' }, wait);
    const ceiling = within(jooble).getByRole('textbox', { name: 'Jooble daily ceiling' });
    await user.clear(ceiling);
    await user.type(ceiling, 'abc');
    expect(ceiling).toHaveAccessibleDescription('A whole number of calls.');
  });

  it('turns a paused provider back on without claiming its health', async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <WithToaster>
        <ProvidersScreen />
      </WithToaster>,
    );

    const remotive = await screen.findByRole('region', { name: 'Remotive' }, wait);
    const toggle = within(remotive).getByRole('switch', { name: 'Remotive off' });
    await user.click(toggle);
    expect(await screen.findByText('Remotive is back on', {}, wait)).toBeInTheDocument();
    expect(within(remotive).getByText('Shown on results')).toBeInTheDocument();
    expect(within(remotive).getByText('n/a')).toBeInTheDocument();
    // The pre-pause trend isn't redrawn as a healthy line.
    expect(remotive.querySelector('svg.w-40')).toBeNull();
    expect(toggle).toHaveFocus();
  });

  it('shows the empty state when no provider is set up', async () => {
    renderWithQuery(
      <WithToaster>
        <ProvidersScreen />
      </WithToaster>,
      'empty',
    );
    expect(await screen.findByText('No job providers', {}, wait)).toBeInTheDocument();
  });
});
